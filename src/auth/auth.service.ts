import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { SignUpDto } from './dtos/signup.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
 import { LoginDto } from './dtos/login.dto';
 import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { hashToken } from '../common/utils/hash-token';
import { ChangePasswordDto } from './dtos/change-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private getRefreshTokenExpiryDate(): Date {
    const refreshTokenDays = Number(
      this.configService.getOrThrow('REFRESH_TOKEN_EXPIRY_DAYS'),
    );

    console.log('Refresh token expires in days:', refreshTokenDays);

    return new Date(Date.now() + refreshTokenDays * 24 * 60 * 60 * 1000);
  }

  private async generateTokens(userId: string, email: string) {
    const payload = {
      sub: userId,
      email,
    };

    const accessToken = await this.jwtService.signAsync(
      {
        ...payload,
        type: 'access',
      },
      {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.getOrThrow('JWT_ACCESS_EXPIRES_IN'),
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      {
        ...payload,
        type: 'refresh',
      },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.getOrThrow('JWT_REFRESH_EXPIRES_IN'),
      },
    );

    return {
      accessToken,
      refreshToken,
    };
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (changePasswordDto.oldPassword === changePasswordDto.newPassword) {
      throw new BadRequestException(
        'New password cannot be the same as the old password',
      );
    }

    // Compare Old Passwords
    const matches = await bcrypt.compare(
      changePasswordDto.oldPassword,
      user.password,
    );

    if (!matches) {
      throw new BadRequestException('Invalid old password');
    }

    // Atomic Transaction: Update Password and Revoke Refresh Tokens
    await this.prisma.$transaction(async (prisma) => {
      const rounds = Number(
        this.configService.getOrThrow('BCRYPT_SALT_ROUNDS'),
      );

      // Update Password
      const hashedPassword = await bcrypt.hash(
        changePasswordDto.newPassword,
        rounds,
      );

      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });

      // Revoke all refresh tokens for the user
      await prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  async refresh(refreshToken: string) {
    // Verify refresh token
    const payload = await this.jwtService.verifyAsync(refreshToken, {
      secret: this.configService.getOrThrow('JWT_REFRESH_SECRET'),
    });

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token');
    }

    // Hash token
    const hashedToken = hashToken(refreshToken);

    // Find refresh token in database
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashedToken },
      include: { user: true },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check if the userId (in payload)  ==  userId in the stored token
    // This is to ensure that the refresh token belongs to the user
    // who is trying to refresh their access token
    if (storedToken.userId !== payload.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check if the refresh token is expired
    if (storedToken.revokedAt) {
      throw new UnauthorizedException('Refresh token revoked');
    }

    if (storedToken.expiresAt <= new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Generate new tokens
    const tokens = await this.generateTokens(
      storedToken.user.id,
      storedToken.user.email,
    );

    try {
      // Save new refresh token and revoke the old one
      await this.prisma.$transaction(async (prisma) => {
        // Revoke old refresh token
        await prisma.refreshToken.update({
          where: { id: storedToken.id },
          data: { revokedAt: new Date() },
        });

        const expiresAt = this.getRefreshTokenExpiryDate();

        // Save new refresh token
        await prisma.refreshToken.create({
          data: {
            userId: storedToken.user.id,
            tokenHash: hashToken(tokens.refreshToken),
            expiresAt,
          },
        });
      });

      console.log({
        access_token: tokens.accessToken,
        ' refresh_token': tokens.refreshToken,
      });

      return {
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      };
    } catch (error) {
      console.log('Error during refresh token transaction:', error);
      return { message: `failed to refresh ${error}` };
    }
  }

  async logout(refreshToken: string) {
    // Verify refresh token
    const payload = await this.jwtService.verifyAsync(refreshToken, {
      secret: this.configService.getOrThrow('JWT_REFRESH_SECRET'),
    });

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token');
    }

    // Hash token
    const hashedToken = hashToken(refreshToken);

    // Find refresh token in DB
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashedToken },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Revoke the refresh token
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    // Return success message
    return { message: 'Logged out successfully' };
  }
  async signUp(signUpDto: SignUpDto) {
    const email = signUpDto.email.toLowerCase().trim();
    const username = signUpDto.username.toLowerCase().trim();
    const hobby = signUpDto.hobby?.toLowerCase().trim();

    try {
      // Hash password
      const hashedPassword = await bcrypt.hash(signUpDto.password.trim(), 10);

      return await this.prisma.$transaction(async (prisma) => {
        // Create user
        const user = await prisma.user.create({
          data: {
            email,
            username,
            hobby,
            password: hashedPassword,
          },
        });

        const { password, ...safeUser } = user;

        // Generate tokens
        const tokens = await this.generateTokens(user.id, user.email);

        // Save refresh token
        await prisma.refreshToken.create({
          data: {
            userId: user.id,
            tokenHash: hashToken(tokens.refreshToken),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });

        return {
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          user: safeUser,
        };
      });
    } catch (error: any) {
      console.log(error);

      if (error?.code === 'P2002') {
        throw new BadRequestException('Email or username already exists');
      }

      throw new InternalServerErrorException('Something went wrong');
    }
  }

  async login({ email, password }: LoginDto) {
    // Check user in DATABASE
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        hobby: true,
        password: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Compare password if user found
    const matches = await bcrypt.compare(password, user.password);

    if (!matches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email);

    const expiresAt = this.getRefreshTokenExpiryDate();
    // Save refresh token in DB
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(tokens.refreshToken),
        expiresAt: expiresAt,
      },
    });

    const { password: _, ...safeUser } = user;

    return {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      user: safeUser,
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new NotFoundException('Profile not found');
    }

    const { password, ...safeUser } = user;
    return safeUser;
  }
}

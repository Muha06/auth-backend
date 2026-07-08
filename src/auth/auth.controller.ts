import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignUpDto } from './dtos/signup.dto';
import { LoginDto } from './dtos/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guards';
import { ChangePasswordDto } from './dtos/change-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup') // auth/signup
  async signUp(@Body() signUpDto: SignUpDto) {
    return this.authService.signUp(signUpDto);
  }

  @Post('login') // auth/login
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT) // return 204 No Content
  async logout(@Body('refreshToken') refreshToken: string): Promise<void> {
    await this.authService.logout(refreshToken);
  }

  @Post('refresh') // auth/refresh
  async refresh(@Body('refreshToken') refreshToken: string) {
    console.log('Received refresh token:', refreshToken);
    return this.authService.refresh(refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@Req() req) {
    return this.authService.getMe(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Patch('change-password')
  async changePassword(
    @Req() req, // From the guard
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(req.user.userId, changePasswordDto);
  }
}

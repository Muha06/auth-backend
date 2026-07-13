import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { MailModule } from './mail/mail.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    MailModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),  
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

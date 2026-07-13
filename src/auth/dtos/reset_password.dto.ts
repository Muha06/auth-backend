import { IsString, Length } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @Length(6, 100)
  newPassword!: string;

  @IsString()
  token!: string;
}

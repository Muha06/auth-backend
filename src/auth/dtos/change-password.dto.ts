import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @MinLength(6)
  @MaxLength(100)
  oldPassword!: string;

  @MinLength(6)
  @MaxLength(100)
  newPassword!: string;
}

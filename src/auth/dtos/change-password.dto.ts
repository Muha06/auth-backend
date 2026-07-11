import { Length } from 'class-validator';

export class ChangePasswordDto {
  @Length(6, 100)
  oldPassword!: string;

  @Length(6, 100)
  newPassword!: string;
}

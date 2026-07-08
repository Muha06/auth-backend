import { IsEmail, IsString, MinLength } from 'class-validator';

export class SignUpDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(4)
  username!: string;

  @IsString()
  @MinLength(6)
  password!: string;
  
  @IsString()
  hobby?: string

}

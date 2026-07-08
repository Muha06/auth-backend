import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Make it global so we dont have to do:  imports: [PrismaService] in other modules
@Module({
  providers: [PrismaService], // Make Nest manage this service: instantiate, manage it...
  exports: [PrismaService], // Allow other models to use this service
})
export class PrismaModule {}

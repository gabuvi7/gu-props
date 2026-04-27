import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/prisma";
import { RequestContextModule } from "../../common/request-context/request-context.module";
import { OwnersController } from "./owners.controller";
import { OwnersService } from "./owners.service";

@Module({
  imports: [PrismaModule, RequestContextModule],
  controllers: [OwnersController],
  providers: [OwnersService],
  exports: [OwnersService]
})
export class OwnersModule {}

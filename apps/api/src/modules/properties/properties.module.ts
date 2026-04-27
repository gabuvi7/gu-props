import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/prisma";
import { RequestContextModule } from "../../common/request-context/request-context.module";
import { PropertiesController } from "./properties.controller";
import { PropertiesService } from "./properties.service";

@Module({
  imports: [PrismaModule, RequestContextModule],
  controllers: [PropertiesController],
  providers: [PropertiesService],
  exports: [PropertiesService]
})
export class PropertiesModule {}

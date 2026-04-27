import { Module } from "@nestjs/common";
import { PropertiesService } from "./properties.service";

@Module({ providers: [PropertiesService], exports: [PropertiesService] })
export class PropertiesModule {}

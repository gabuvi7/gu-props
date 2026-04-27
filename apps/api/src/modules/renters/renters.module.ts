import { Module } from "@nestjs/common";
import { RentersService } from "./renters.service";

@Module({ providers: [RentersService], exports: [RentersService] })
export class RentersModule {}

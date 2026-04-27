import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { parseRequestBody } from "../../common/validation/zod-validation";
import { createRenterSchema, updateRenterSchema } from "./renters.dto";
import { RentersService } from "./renters.service";

@Controller("renters")
export class RentersController {
  constructor(private readonly rentersService: RentersService) {}

  @Post()
  create(@Body() body: unknown) {
    return this.rentersService.createRenter(parseRequestBody(createRenterSchema, body));
  }

  @Get()
  list() {
    return this.rentersService.listRenters();
  }

  @Get(":id")
  getById(@Param("id") id: string) {
    return this.rentersService.getRenterById(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: unknown) {
    return this.rentersService.updateRenter(id, parseRequestBody(updateRenterSchema, body));
  }
}

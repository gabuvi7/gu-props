import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { parseRequestBody } from "../../common/validation/zod-validation";
import { createOwnerSchema, updateOwnerSchema } from "./owners.dto";
import { OwnersService } from "./owners.service";

@Controller("owners")
export class OwnersController {
  constructor(private readonly ownersService: OwnersService) {}

  @Post()
  create(@Body() body: unknown) {
    return this.ownersService.createOwner(parseRequestBody(createOwnerSchema, body));
  }

  @Get()
  list() {
    return this.ownersService.listOwners();
  }

  @Get(":id")
  getById(@Param("id") id: string) {
    return this.ownersService.getOwnerById(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: unknown) {
    return this.ownersService.updateOwner(id, parseRequestBody(updateOwnerSchema, body));
  }
}

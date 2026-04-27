import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { parseRequestBody } from "../../common/validation/zod-validation";
import { createPropertySchema, updatePropertySchema } from "./properties.dto";
import { PropertiesService } from "./properties.service";

@Controller("properties")
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Post()
  create(@Body() body: unknown) {
    return this.propertiesService.createProperty(parseRequestBody(createPropertySchema, body));
  }

  @Get()
  list() {
    return this.propertiesService.listProperties();
  }

  @Get(":id")
  getById(@Param("id") id: string) {
    return this.propertiesService.getPropertyById(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: unknown) {
    return this.propertiesService.updateProperty(id, parseRequestBody(updatePropertySchema, body));
  }
}

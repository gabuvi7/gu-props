import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { parseRequestBody } from "../../common/validation/zod-validation";
import { createTenantSchema } from "./tenants.dto";
import { TenantsService } from "./tenants.service";

@Controller("tenants")
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  create(@Body() body: unknown) {
    return this.tenantsService.createTenant(parseRequestBody(createTenantSchema, body));
  }

  @Get()
  list() {
    return this.tenantsService.listTenants();
  }

  @Get(":id")
  getById(@Param("id") id: string) {
    return this.tenantsService.getTenantById(id);
  }
}

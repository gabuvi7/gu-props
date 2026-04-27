import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { parseRequestBody } from "../../common/validation/zod-validation";
import { changeContractStatusSchema, createContractSchema, updateContractSchema } from "./contracts.dto";
import { ContractsService } from "./contracts.service";

@Controller("contracts")
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Post()
  create(@Body() body: unknown) {
    return this.contractsService.createContract(parseRequestBody(createContractSchema, body));
  }

  @Get()
  list() {
    return this.contractsService.listContracts();
  }

  @Get("active")
  listActive() {
    return this.contractsService.listActiveContracts();
  }

  @Get(":id")
  getById(@Param("id") id: string) {
    return this.contractsService.getContractById(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: unknown) {
    return this.contractsService.updateContract(id, parseRequestBody(updateContractSchema, body));
  }

  @Patch(":id/status")
  changeStatus(@Param("id") id: string, @Body() body: unknown) {
    return this.contractsService.changeContractStatus(id, parseRequestBody(changeContractStatusSchema, body).status);
  }
}

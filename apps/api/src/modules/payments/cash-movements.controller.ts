import { Controller, Get, Query } from "@nestjs/common";
import { parseRequestBody } from "../../common/validation/zod-validation";
import { listCashMovementsQuerySchema } from "./payments.dto";
import { PaymentsService } from "./payments.service";

@Controller("cash-movements")
export class CashMovementsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  list(@Query() query: unknown) {
    return this.paymentsService.listCashMovements(parseRequestBody(listCashMovementsQuerySchema, query));
  }
}

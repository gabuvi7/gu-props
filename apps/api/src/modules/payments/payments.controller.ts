import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { parseRequestBody } from "../../common/validation/zod-validation";
import { balanceQuerySchema, createPaymentSchema, listPaymentsQuerySchema } from "./payments.dto";
import { PaymentsService } from "./payments.service";

@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  create(@Body() body: unknown) {
    return this.paymentsService.createPayment(parseRequestBody(createPaymentSchema, body));
  }

  @Get()
  list(@Query() query: unknown) {
    return this.paymentsService.listPayments(parseRequestBody(listPaymentsQuerySchema, query));
  }

  @Get("balance")
  getBalance(@Query() query: unknown) {
    const parsed = parseRequestBody(balanceQuerySchema, query);
    return this.paymentsService.getContractBalance(parsed.contractId);
  }

  @Get(":id")
  getById(@Param("id") id: string) {
    return this.paymentsService.getPaymentById(id);
  }
}

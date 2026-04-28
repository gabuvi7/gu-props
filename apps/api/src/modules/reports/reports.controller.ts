import { Controller, Get, Param, Query } from "@nestjs/common";
import { parseRequestBody } from "../../common/validation/zod-validation";
import {
  cashFlowQuerySchema,
  outstandingBalancesQuerySchema,
  renterHistoryParamsSchema,
  upcomingDuePaymentsQuerySchema
} from "./reports.dto";
import { ReportsService } from "./reports.service";

@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("renter-history/:renterId")
  getRenterHistory(@Param("renterId") renterId: string) {
    const parsed = parseRequestBody(renterHistoryParamsSchema, { renterId });
    return this.reportsService.getRenterHistory(parsed.renterId);
  }

  @Get("upcoming-due-payments")
  getUpcomingDuePayments(@Query() query: unknown) {
    return this.reportsService.getUpcomingDuePayments(parseRequestBody(upcomingDuePaymentsQuerySchema, query));
  }

  @Get("cash-flow")
  getCashFlow(@Query() query: unknown) {
    return this.reportsService.getCashFlow(parseRequestBody(cashFlowQuerySchema, query));
  }

  @Get("outstanding-balances")
  getOutstandingBalances(@Query() query: unknown) {
    return this.reportsService.getOutstandingBalances(parseRequestBody(outstandingBalancesQuerySchema, query));
  }
}

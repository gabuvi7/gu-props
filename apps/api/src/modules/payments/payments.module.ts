import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/prisma";
import { RequestContextModule } from "../../common/request-context/request-context.module";
import { CashMovementsController } from "./cash-movements.controller";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

@Module({
  imports: [PrismaModule, RequestContextModule],
  controllers: [PaymentsController, CashMovementsController],
  providers: [PaymentsService],
  exports: [PaymentsService]
})
export class PaymentsModule {}

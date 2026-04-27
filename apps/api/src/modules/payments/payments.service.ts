import { allocatePaymentAmount, type Money } from "@gu-prop/shared";
import { TenantAwareRepository, type TenantScopedRecord } from "../../common/persistence/tenant-aware.repository";

export type PaymentRecord = TenantScopedRecord & { contractId: string; renterId: string };

export class PaymentsService {
  constructor(private readonly payments: TenantAwareRepository<PaymentRecord>) {}

  calculatePayment(due: Money, paid: Money) {
    return allocatePaymentAmount(due, paid);
  }

  findPaymentForTenant(id: string) {
    return this.payments.findById(id);
  }
}

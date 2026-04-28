import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  CashMovement,
  CashMovementType,
  Currency,
  Payment,
  Prisma,
  RentalContract,
  RentalContractStatus
} from "@gu-prop/database";
import { fromCents, toCents } from "../../common/money/decimal-cents";
import { PrismaService } from "../../common/prisma";
import { RequestContextService } from "../../common/request-context/request-context.service";
import type {
  CashFlowQueryDto,
  OutstandingBalancesQueryDto,
  UpcomingDuePaymentsQueryDto
} from "./reports.dto";

const DEFAULT_RANGE_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type RenterHistoryContract = {
  id: string;
  propertyId: string;
  status: RentalContractStatus;
  startsAt: Date;
  endsAt: Date;
  currency: Currency;
  rentAmount: string;
};

export type RenterHistory = {
  renterId: string;
  renter: { id: string; displayName: string; email: string | null; phone: string | null };
  contracts: RenterHistoryContract[];
  payments: Payment[];
  totals: {
    currency: Currency;
    totalDue: string;
    totalPaid: string;
    pendingDebt: string;
    creditBalance: string;
  };
};

export type UpcomingDuePaymentsReport = {
  from: string;
  to: string;
  total: number;
  payments: Array<
    Payment & {
      contract: { id: string; propertyId: string; renterId: string; ownerId: string };
    }
  >;
};

export type CashFlowReport = {
  month: string;
  periodStart: string;
  periodEnd: string;
  currency: Currency;
  totals: {
    income: string;
    expense: string;
    commission: string;
    ownerPayout: string;
    adjustment: string;
    net: string;
  };
  movementsByType: Record<CashMovementType, number>;
  movements: CashMovement[];
};

export type OutstandingBalanceItem = {
  contractId: string;
  propertyId: string;
  renterId: string;
  ownerId: string;
  renterName: string;
  propertyAddress: string;
  currency: Currency;
  pendingDebt: string;
  overduePaymentsCount: number;
  nextDueAt: Date | null;
};

export type OutstandingBalancesReport = {
  asOf: string;
  total: number;
  items: OutstandingBalanceItem[];
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contextService: RequestContextService
  ) {}

  // US-013 — Historial de inquilino.
  // Multi-currency MVP: si el inquilino tiene pagos en distintas monedas,
  // los totales SOLO incluyen la moneda dominante (la del último contrato activo,
  // o ARS por default si no hay contratos). Multi-currency real es un US futuro.
  async getRenterHistory(renterId: string): Promise<RenterHistory> {
    const { tenantId } = this.contextService.get();

    const renter = await this.prisma.renter.findUnique({
      where: { id_tenantId: { id: renterId, tenantId } }
    });

    if (!renter || renter.deletedAt) {
      throw new NotFoundException("No encontramos el inquilino solicitado.");
    }

    const [contracts, payments] = await Promise.all([
      this.prisma.rentalContract.findMany({
        where: { tenantId, renterId },
        orderBy: { startsAt: "desc" }
      }),
      this.prisma.payment.findMany({
        where: { tenantId, renterId },
        orderBy: { dueAt: "desc" }
      })
    ]);

    const dominantCurrency = pickDominantCurrency(contracts);
    const totals = aggregatePaymentTotals(payments, dominantCurrency);

    return {
      renterId,
      renter: {
        id: renter.id,
        displayName: renter.displayName,
        email: renter.email,
        phone: renter.phone
      },
      contracts: contracts.map((contract) => ({
        id: contract.id,
        propertyId: contract.propertyId,
        status: contract.status,
        startsAt: contract.startsAt,
        endsAt: contract.endsAt,
        currency: contract.currency,
        rentAmount: contract.rentAmount.toString()
      })),
      payments,
      totals: {
        currency: dominantCurrency,
        ...totals
      }
    };
  }

  // US-028 — Vencimientos próximos (PENDING/PARTIAL en rango).
  async getUpcomingDuePayments(query: UpcomingDuePaymentsQueryDto): Promise<UpcomingDuePaymentsReport> {
    const { tenantId } = this.contextService.get();

    const now = new Date();
    const fromDate = query.from ? new Date(query.from) : startOfDay(now);
    const toDate = query.to ? new Date(query.to) : new Date(fromDate.getTime() + DEFAULT_RANGE_DAYS * MS_PER_DAY);

    if (fromDate.getTime() > toDate.getTime()) {
      throw new BadRequestException("El rango de fechas no es válido.");
    }

    const where: Prisma.PaymentWhereInput = {
      tenantId,
      status: { in: ["PENDING", "PARTIAL"] },
      dueAt: { gte: fromDate, lte: toDate },
      ...(query.contractId !== undefined ? { contractId: query.contractId } : {}),
      ...(query.renterId !== undefined ? { renterId: query.renterId } : {}),
      ...(query.propertyId !== undefined ? { contract: { propertyId: query.propertyId } } : {})
    };

    const payments = await this.prisma.payment.findMany({
      where,
      include: {
        contract: {
          select: { id: true, propertyId: true, renterId: true, ownerId: true }
        }
      },
      orderBy: { dueAt: "asc" }
    });

    return {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      total: payments.length,
      payments: payments as UpcomingDuePaymentsReport["payments"]
    };
  }

  // US-029 — Caja mensual (agregaciones de CashMovement por tipo).
  // Multi-currency MVP: si hay movimientos en monedas mixtas, devolvemos ARS y
  // dejamos un TODO. Tratamiento real (split por currency) queda para US futuro.
  // Net formula: income - expense - ownerPayout. Commission y adjustment NO restan
  // porque commission es ingreso ya contenido en income y adjustment puede tener
  // signo arbitrario; el operador los ve aparte.
  async getCashFlow(query: CashFlowQueryDto): Promise<CashFlowReport> {
    const { tenantId } = this.contextService.get();

    const [yearStr, monthStr] = query.month.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    const periodStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const periodEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const movements = await this.prisma.cashMovement.findMany({
      where: { tenantId, occurredAt: { gte: periodStart, lte: periodEnd } },
      orderBy: { occurredAt: "asc" }
    });

    const buckets: Record<CashMovementType, bigint> = {
      INCOME: 0n,
      EXPENSE: 0n,
      COMMISSION: 0n,
      OWNER_PAYOUT: 0n,
      ADJUSTMENT: 0n
    };
    const counts: Record<CashMovementType, number> = {
      INCOME: 0,
      EXPENSE: 0,
      COMMISSION: 0,
      OWNER_PAYOUT: 0,
      ADJUSTMENT: 0
    };

    const currencies = new Set<Currency>();
    for (const movement of movements) {
      buckets[movement.type] += toCents(movement.amount);
      counts[movement.type] += 1;
      currencies.add(movement.currency);
    }

    const dominantCurrency: Currency = currencies.size > 1 ? "ARS" : (movements[0]?.currency ?? "ARS");
    if (currencies.size > 1) {
      // TODO multi-currency real (US futuro): agrupar totales por moneda en lugar de forzar ARS.
      // Por ahora dejamos esta nota visible en el código para que sea explícito.
    }

    const net = buckets.INCOME - buckets.EXPENSE - buckets.OWNER_PAYOUT;

    return {
      month: query.month,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      currency: dominantCurrency,
      totals: {
        income: fromCents(buckets.INCOME),
        expense: fromCents(buckets.EXPENSE),
        commission: fromCents(buckets.COMMISSION),
        ownerPayout: fromCents(buckets.OWNER_PAYOUT),
        adjustment: fromCents(buckets.ADJUSTMENT),
        net: fromCents(net)
      },
      movementsByType: counts,
      movements
    };
  }

  // US-030 — Saldos pendientes por contrato.
  async getOutstandingBalances(query: OutstandingBalancesQueryDto): Promise<OutstandingBalancesReport> {
    const { tenantId } = this.contextService.get();
    const asOfDate = query.asOf ? new Date(query.asOf) : new Date();

    const contractWhere: Prisma.RentalContractWhereInput = {
      tenantId,
      ...(query.propertyId !== undefined ? { propertyId: query.propertyId } : {}),
      ...(query.ownerId !== undefined ? { ownerId: query.ownerId } : {})
    };

    const contracts = await this.prisma.rentalContract.findMany({
      where: contractWhere,
      include: {
        property: { select: { addressLine: true } },
        renter: { select: { displayName: true } },
        payments: {
          where: { tenantId },
          orderBy: { dueAt: "asc" }
        }
      }
    });

    const items: OutstandingBalanceItem[] = [];

    for (const contract of contracts) {
      let pendingDebtCents = 0n;
      let overdueCount = 0;
      let nextDueAt: Date | null = null;

      for (const payment of contract.payments) {
        if (payment.status === "VOIDED") {
          continue;
        }
        pendingDebtCents += toCents(payment.remainingDebt);

        const isOpen = payment.status === "PENDING" || payment.status === "PARTIAL";
        if (!isOpen) {
          continue;
        }

        if (payment.dueAt.getTime() < asOfDate.getTime()) {
          overdueCount += 1;
        } else if (nextDueAt === null || payment.dueAt.getTime() < nextDueAt.getTime()) {
          nextDueAt = payment.dueAt;
        }
      }

      if (pendingDebtCents <= 0n) {
        continue;
      }

      items.push({
        contractId: contract.id,
        propertyId: contract.propertyId,
        renterId: contract.renterId,
        ownerId: contract.ownerId,
        renterName: contract.renter.displayName,
        propertyAddress: contract.property.addressLine,
        currency: contract.currency,
        pendingDebt: fromCents(pendingDebtCents),
        overduePaymentsCount: overdueCount,
        nextDueAt
      });
    }

    items.sort((a, b) => {
      const aCents = toCents(a.pendingDebt);
      const bCents = toCents(b.pendingDebt);
      if (bCents === aCents) return 0;
      return bCents > aCents ? 1 : -1;
    });

    return {
      asOf: asOfDate.toISOString(),
      total: items.length,
      items
    };
  }
}

// Helpers privados del módulo reports.

function startOfDay(date: Date): Date {
  const copy = new Date(date.getTime());
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function pickDominantCurrency(contracts: RentalContract[]): Currency {
  if (contracts.length === 0) {
    return "ARS";
  }
  const active = contracts.find((contract) => contract.status === "ACTIVE");
  return (active ?? contracts[0]).currency;
}

function aggregatePaymentTotals(
  payments: Payment[],
  currency: Currency
): { totalDue: string; totalPaid: string; pendingDebt: string; creditBalance: string } {
  let totalDueCents = 0n;
  let totalPaidCents = 0n;
  let pendingDebtCents = 0n;
  let creditBalanceCents = 0n;

  for (const payment of payments) {
    if (payment.currency !== currency) {
      continue;
    }
    totalDueCents += toCents(payment.dueAmount);
    totalPaidCents += toCents(payment.paidAmount);
    if (payment.status !== "VOIDED") {
      pendingDebtCents += toCents(payment.remainingDebt);
      creditBalanceCents += toCents(payment.creditBalance);
    }
  }

  return {
    totalDue: fromCents(totalDueCents),
    totalPaid: fromCents(totalPaidCents),
    pendingDebt: fromCents(pendingDebtCents),
    creditBalance: fromCents(creditBalanceCents)
  };
}


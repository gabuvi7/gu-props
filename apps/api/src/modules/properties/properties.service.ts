import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, Property } from "@gu-prop/database";
import { PrismaService } from "../../common/prisma";
import { RequestContextService } from "../../common/request-context/request-context.service";
import type { CreatePropertyDto, UpdatePropertyDto } from "./properties.dto";

export type PropertyRecord = Property;

@Injectable()
export class PropertiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contextService: RequestContextService
  ) {}

  async createProperty(input: CreatePropertyDto): Promise<PropertyRecord> {
    const { tenantId } = this.contextService.get();
    await this.ensureOwnerBelongsToTenant(input.ownerId, tenantId);

    try {
      return await this.prisma.property.create({
        data: toPropertyCreateData(input, tenantId)
      });
    } catch {
      throw new BadRequestException("No pudimos crear la propiedad. Revisá los datos enviados.");
    }
  }

  listProperties(): Promise<PropertyRecord[]> {
    const { tenantId } = this.contextService.get();
    return this.prisma.property.findMany({ where: { tenantId, deletedAt: null }, orderBy: { addressLine: "asc" } });
  }

  async getPropertyById(id: string): Promise<PropertyRecord> {
    const property = await this.findActiveProperty(id);
    if (!property) {
      throw new NotFoundException("No encontramos la propiedad solicitada.");
    }

    return property;
  }

  findPropertyForTenant(id: string) {
    return this.getPropertyById(id);
  }

  async updateProperty(id: string, input: UpdatePropertyDto): Promise<PropertyRecord> {
    const { tenantId } = this.contextService.get();
    const property = await this.findActiveProperty(id, tenantId);

    if (!property) {
      throw new NotFoundException("No encontramos la propiedad solicitada.");
    }

    if (input.ownerId !== undefined) {
      await this.ensureOwnerBelongsToTenant(input.ownerId, tenantId);
    }

    try {
      return await this.prisma.property.update({
        where: { id_tenantId: { id, tenantId } },
        data: toPropertyUpdateData(input)
      });
    } catch {
      throw new BadRequestException("No pudimos actualizar la propiedad. Revisá los datos enviados.");
    }
  }

  private findActiveProperty(id: string, tenantId = this.contextService.get().tenantId): Promise<PropertyRecord | null> {
    return this.prisma.property.findFirst({ where: { id, tenantId, deletedAt: null } });
  }

  private async ensureOwnerBelongsToTenant(ownerId: string, tenantId: string): Promise<void> {
    const owner = await this.prisma.owner.findFirst({ where: { id: ownerId, tenantId, deletedAt: null } });
    if (!owner) {
      throw new BadRequestException("El propietario indicado no existe en esta inmobiliaria.");
    }
  }
}

function toPropertyCreateData(input: CreatePropertyDto, tenantId: string): Prisma.PropertyUncheckedCreateInput {
  return {
    tenantId,
    ownerId: input.ownerId,
    type: input.type,
    addressLine: input.addressLine,
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.city !== undefined ? { city: input.city } : {}),
    ...(input.province !== undefined ? { province: input.province } : {}),
    ...(input.postalCode !== undefined ? { postalCode: input.postalCode } : {}),
    ...(input.commissionBps !== undefined ? { commissionBps: input.commissionBps } : {})
  };
}

function toPropertyUpdateData(input: UpdatePropertyDto): Prisma.PropertyUncheckedUpdateInput {
  return {
    ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
    ...(input.type !== undefined ? { type: input.type } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.addressLine !== undefined ? { addressLine: input.addressLine } : {}),
    ...(input.city !== undefined ? { city: input.city } : {}),
    ...(input.province !== undefined ? { province: input.province } : {}),
    ...(input.postalCode !== undefined ? { postalCode: input.postalCode } : {}),
    ...(input.commissionBps !== undefined ? { commissionBps: input.commissionBps } : {})
  };
}

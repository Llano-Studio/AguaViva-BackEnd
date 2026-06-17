import { PrismaService } from './prisma.service';

export abstract class PrismaBackedService {
  constructor(protected readonly prisma: PrismaService) {}

  get $connect() {
    return this.prisma.$connect.bind(this.prisma);
  }

  get $disconnect() {
    return this.prisma.$disconnect.bind(this.prisma);
  }

  get $transaction() {
    return this.prisma.$transaction.bind(this.prisma);
  }

  get $queryRaw() {
    return this.prisma.$queryRaw.bind(this.prisma);
  }

  get $queryRawUnsafe() {
    return this.prisma.$queryRawUnsafe.bind(this.prisma);
  }

  get $executeRaw() {
    return this.prisma.$executeRaw.bind(this.prisma);
  }

  get $executeRawUnsafe() {
    return this.prisma.$executeRawUnsafe.bind(this.prisma);
  }

  get user() {
    return this.prisma.user;
  }

  get refreshToken() {
    return this.prisma.refreshToken;
  }

  get country() {
    return this.prisma.country;
  }

  get province() {
    return this.prisma.province;
  }

  get locality() {
    return this.prisma.locality;
  }

  get zone() {
    return this.prisma.zone;
  }

  get product_category() {
    return this.prisma.product_category;
  }

  get product() {
    return this.prisma.product;
  }

  get price_list() {
    return this.prisma.price_list;
  }

  get price_list_item() {
    return this.prisma.price_list_item;
  }

  get price_list_history() {
    return this.prisma.price_list_history;
  }

  get warehouse() {
    return this.prisma.warehouse;
  }

  get inventory() {
    return this.prisma.inventory;
  }

  get movement_type() {
    return this.prisma.movement_type;
  }

  get stock_movement() {
    return this.prisma.stock_movement;
  }

  get person() {
    return this.prisma.person;
  }

  get client_contract() {
    return this.prisma.client_contract;
  }

  get contract_delivery_schedule() {
    return this.prisma.contract_delivery_schedule;
  }

  get sale_channel() {
    return this.prisma.sale_channel;
  }

  get order_header() {
    return this.prisma.order_header;
  }

  get order_item() {
    return this.prisma.order_item;
  }

  get payment_method() {
    return this.prisma.payment_method;
  }

  get payment_transaction() {
    return this.prisma.payment_transaction;
  }

  get payment_audit() {
    return this.prisma.payment_audit;
  }

  get payment_line() {
    return this.prisma.payment_line;
  }

  get payment_installment() {
    return this.prisma.payment_installment;
  }

  get installment_order_link() {
    return this.prisma.installment_order_link;
  }

  get vehicle() {
    return this.prisma.vehicle;
  }

  get vehicle_inventory() {
    return this.prisma.vehicle_inventory;
  }

  get vehicle_zone() {
    return this.prisma.vehicle_zone;
  }

  get user_vehicle() {
    return this.prisma.user_vehicle;
  }

  get route_sheet() {
    return this.prisma.route_sheet;
  }

  get route_sheet_detail() {
    return this.prisma.route_sheet_detail;
  }

  get route_optimization() {
    return this.prisma.route_optimization;
  }

  get vehicle_route_inventory() {
    return this.prisma.vehicle_route_inventory;
  }

  get inventory_transaction() {
    return this.prisma.inventory_transaction;
  }

  get delivery_evidence() {
    return this.prisma.delivery_evidence;
  }

  get delivery_incident() {
    return this.prisma.delivery_incident;
  }

  get delivery_stats() {
    return this.prisma.delivery_stats;
  }

  get subscription_plan() {
    return this.prisma.subscription_plan;
  }

  get subscription_plan_product() {
    return this.prisma.subscription_plan_product;
  }

  get customer_subscription() {
    return this.prisma.customer_subscription;
  }

  get cycle_payment() {
    return this.prisma.cycle_payment;
  }

  get subscription_cycle() {
    return this.prisma.subscription_cycle;
  }

  get subscription_cycle_detail() {
    return this.prisma.subscription_cycle_detail;
  }

  get subscription_delivery_schedule() {
    return this.prisma.subscription_delivery_schedule;
  }

  get collection_orders() {
    return this.prisma.collection_orders;
  }

  get one_off_purchase() {
    return this.prisma.one_off_purchase;
  }

  get one_off_purchase_header() {
    return this.prisma.one_off_purchase_header;
  }

  get cancellation_order() {
    return this.prisma.cancellation_order;
  }

  get comodato() {
    return this.prisma.comodato;
  }

  get recovery_order() {
    return this.prisma.recovery_order;
  }
}

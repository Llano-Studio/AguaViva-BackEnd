--
-- Datos extraídos del backup completo
-- Solo datos, sin estructura de tablas
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- Data for Name: RefreshToken; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public."RefreshToken" (id, token, "userId", "expiresAt", "createdAt") FROM stdin;
1	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzUxNjY4MjEzLCJleHAiOjE3NTIyNzMwMTN9.WCmOXuvAjUf1iG6ZldmcllcX6vZFtoEbj1fDzE3I7A0	1	2025-07-11 22:30:13.486	2025-07-04 22:30:13.488
2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzUxNjY4MjgwLCJleHAiOjE3NTIyNzMwODB9.eC_6VfiUDxu8XiTq8lqcQedm_GpcZXt-pED-VSwfaoY	1	2025-07-11 22:31:20.136	2025-07-04 22:31:20.137
3	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzUxNzMzOTEyLCJleHAiOjE3NTIzMzg3MTJ9.XjMuDcX55KIvMdMMzAvcVNYFDxd6O1XEkaxlrEhQG8U	1	2025-07-12 16:45:12.929	2025-07-05 16:45:12.931
4	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzUxNzMzOTUyLCJleHAiOjE3NTIzMzg3NTJ9.R6zS3kk9P_tTHoGm6OXvMXFvf04zPqq8XMAdQKl9BnM	1	2025-07-12 16:45:52.724	2025-07-05 16:45:52.725
5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiaWF0IjoxNzUxNzM1NzM5LCJleHAiOjE3NTIzNDA1Mzl9.kgx5lp9adJCsoWMfSa-jHwfW7So7bK3KYisHFzQ_XMQ	2	2025-07-12 17:15:39.745	2025-07-05 17:15:39.747
6	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzUxNzUxNjg3LCJleHAiOjE3NTIzNTY0ODd9.Uax7NNujmOSX2DtiuCTuEYAXD3g3s1RwY-GlH_0uUUc	1	2025-07-12 21:41:27.051	2025-07-05 21:41:27.054
7	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzUxNzUxNzc2LCJleHAiOjE3NTIzNTY1NzZ9.izmMhMsLojKTdC0cYBjP7XwJfeLanbw4Kts8RPTGoZI	1	2025-07-12 21:42:56.765	2025-07-05 21:42:56.767
8	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzUxOTA4MzIwLCJleHAiOjE3NTI1MTMxMjB9.X0t-RoSBpV567JfDOXrlaQRhzKfLsu-eNpI2U2SlMD0	1	2025-07-14 17:12:00.582	2025-07-07 17:12:00.585
9	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzUxOTA5NTI4LCJleHAiOjE3NTI1MTQzMjh9.j7QCSZHrSdpUEagyHSQqA8V5jMbSppcyjTFQRshiv0Y	1	2025-07-14 17:32:08.118	2025-07-07 17:32:08.119
10	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzUxOTI0MzM3LCJleHAiOjE3NTI1MjkxMzd9.wTQhYVih5xuuExKl0onZZIxdsqXjIgPvv6eu5UwYrX4	1	2025-07-14 21:38:57.052	2025-07-07 21:38:57.053
11	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzUxOTI2NDg3LCJleHAiOjE3NTI1MzEyODd9.uZMeYUmfoIOcL_-A8Dm-EkH0yGLem-dzTSPnVpqrEdM	1	2025-07-14 22:14:47.368	2025-07-07 22:14:47.369
\.
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public."User" (id, email, password, name, role, "isActive", "createdAt", "updatedAt", "recoveryToken", "profileImageUrl", "recoveryTokenExpires") FROM stdin;
1	zeniquelrober@gmail.com	$2b$10$2v/ypzG5YCjz7yT5/m8qiuKcDAhLHMTRau7IcltNjPeaEkFKDr9qK	rober zeniquel	ADMIN	t	2025-07-04 22:30:13.354	\N	\N	\N	\N
2	facuzeniquel@gmai.com	$2b$10$zc6bHryAmWAxZUlNfPnK2uAnRbvXwfNosI4IrqwtSr7spLKH.T3se	Facundo Zeniquel	USER	t	2025-07-05 17:15:39.667	\N	\N	\N	\N
\.
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
2b400618-7e0f-4464-8a3b-cfcf53bf3f7a	6a7267832f582005a1e32cba95ad2026d813a0ffd2dda792d6e124acb0da08e6	2025-07-04 22:20:08.455335+00	20250411171150_init	\N	\N	2025-07-04 22:20:08.103495+00	1
ff8a62f7-5925-4cbd-9963-a86969da2927	50b2cb34102feaad7161dd027e9c26da76c2ad9ac8751c519022e1ac6511b33d	2025-07-04 22:20:08.643105+00	20250412220017_	\N	\N	2025-07-04 22:20:08.490109+00	1
fbf938dd-af41-47cd-8db8-f3c6eead4107	8cefa3df92601a15bb817fe8bdcd0d4eeac7ee2bbf043d1f949279f95ad61377	2025-07-04 22:20:13.283213+00	20250429165618_updatecountry	\N	\N	2025-07-04 22:20:08.678295+00	1
12e6fb2d-cdb7-4c09-9edf-fc075ca18d14	7cd5cbc9fef6f41d67978b0366038e089e78e5cb5fcf540aa9309de8efdb43ac	2025-07-04 22:20:15.441692+00	20250516131945_developfinish	\N	\N	2025-07-04 22:20:13.31028+00	1
336c178f-75db-4e1d-b7f7-2680f4f034ee	a89c76e2ef8900f5fa7eb4f40ad09f93211c41e6dedd2ebf3039e966a90956c8	2025-07-04 22:20:16.779268+00	20250611221912_11jun	\N	\N	2025-07-04 22:20:15.474432+00	1
2cea57e6-9a8a-46f1-ae12-ff8b350a1a44	408659ebb652339ddf17bc9f7e741ef680e7fa8166bb5996963e19abda5e58fa	2025-07-04 22:20:17.036306+00	20250625131158_25jun	\N	\N	2025-07-04 22:20:16.814358+00	1
0dc162bb-a303-46f2-87fa-7dc65aca0922	c9703ca3c9e11f158c4e46ffab9db88ae3ece659e572385a05c5e360cc20287f	2025-07-04 22:20:18.052823+00	20250704220544_4jul	\N	\N	2025-07-04 22:20:17.080281+00	1
c793f700-5c38-40bb-a2b4-a490934547f6	a8370eccdeb28fe897823bbae32e9d225c4cf697787210dc3bf9d3141b55ede5	\N	20250708005758_7jul	A migration failed to apply. New migrations cannot be applied before the error is recovered from. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve\n\nMigration name: 20250708005758_7jul\n\nDatabase error code: 2BP01\n\nDatabase error:\nERROR: cannot drop constraint movement_type_pkey on table movement_type because other objects depend on it\nDETAIL: constraint fk_stockmovement_movement_type on table stock_movement depends on index movement_type_pkey\nHINT: Use DROP ... CASCADE to drop the dependent objects too.\n\nDbError { severity: "ERROR", parsed_severity: Some(Error), code: SqlState(E2BP01), message: "cannot drop constraint movement_type_pkey on table movement_type because other objects depend on it", detail: Some("constraint fk_stockmovement_movement_type on table stock_movement depends on index movement_type_pkey"), hint: Some("Use DROP ... CASCADE to drop the dependent objects too."), position: None, where_: None, schema: None, table: None, column: None, datatype: None, constraint: None, file: Some("dependency.c"), line: Some(1204), routine: Some("reportDependentObjects") }\n\n   0: sql_schema_connector::apply_migration::apply_script\n           with migration_name="20250708005758_7jul"\n             at schema-engine/connectors/sql-schema-connector/src/apply_migration.rs:113\n   1: schema_commands::commands::apply_migrations::Applying migration\n           with migration_name="20250708005758_7jul"\n             at schema-engine/commands/src/commands/apply_migrations.rs:91\n   2: schema_core::state::ApplyMigrations\n             at schema-engine/core/src/state.rs:225	2025-07-08 01:01:08.879371+00	2025-07-08 00:58:13.107606+00	0
\.
-- Data for Name: client_contract; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.client_contract (contract_id, person_id, price_list_id, start_date, end_date, notes, status) FROM stdin;
\.
-- Data for Name: contract_delivery_schedule; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.contract_delivery_schedule (schedule_id, contract_id, day_of_week, scheduled_time) FROM stdin;
\.
-- Data for Name: country; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.country (country_id, code, name) FROM stdin;
1	AR	Argentina
2	PY	Paraguay
\.
-- Data for Name: customer_subscription; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.customer_subscription (subscription_id, customer_id, subscription_plan_id, start_date, end_date, notes, status) FROM stdin;
1	1	1	2025-07-05	2025-12-05	{"original_notes":"Suscripción mensual","delivery_preferences":{"preferred_time_range":"09:00-12:00","preferred_days":["MONDAY","WEDNESDAY","FRIDAY"],"avoid_times":["12:00-13:00"],"special_instructions":"Llamar antes de llegar"}}	ACTIVE
2	1	2	2025-07-07	2025-08-08	{"delivery_preferences":{"preferred_time_range":"13:34-18:05","preferred_days":["TUESDAY","THURSDAY","SUNDAY"],"avoid_times":["08:31-10:29"],"special_instructions":"Tocar timbre"}}	ACTIVE
3	6	1	2025-07-07	2025-08-08	{"original_notes":"holaaaaaaaaaaaaaaaaaaaaaaaa","delivery_preferences":{"preferred_time_range":"15:20-18:24","preferred_days":["MONDAY","WEDNESDAY","TUESDAY"],"avoid_times":["17:24-20:24"],"special_instructions":"Avisar antes de ir"}}	ACTIVE
4	6	2	2025-07-07	2025-08-07	{"delivery_preferences":{"preferred_time_range":"10:43","preferred_days":["THURSDAY"],"avoid_times":["23:45"],"special_instructions":"Avisar antes"}}	ACTIVE
\.
-- Data for Name: delivery_evidence; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.delivery_evidence (evidence_id, route_sheet_detail_id, evidence_type, file_path, created_at, created_by) FROM stdin;
\.
-- Data for Name: delivery_incident; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.delivery_incident (incident_id, route_sheet_detail_id, incident_type, description, created_at, created_by, status, resolution, resolved_at, resolved_by) FROM stdin;
\.
-- Data for Name: delivery_stats; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.delivery_stats (stat_id, date, driver_id, vehicle_id, zone_id, route_sheet_id, total_deliveries, completed_deliveries, rejected_deliveries, rescheduled_deliveries, avg_delivery_time, avg_delay_time) FROM stdin;
\.
-- Data for Name: installment_order_link; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.installment_order_link (link_id, installment_id, order_id, "order_itemOrder_item_id") FROM stdin;
\.
-- Data for Name: inventory; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.inventory (warehouse_id, product_id, quantity) FROM stdin;
1	1	100
1	2	50
1	3	100
\.
-- Data for Name: inventory_transaction; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.inventory_transaction (transaction_id, route_sheet_id, detail_id, product_id, quantity, transaction_type, created_at) FROM stdin;
\.
-- Data for Name: locality; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.locality (locality_id, province_id, code, name) FROM stdin;
1	1	RES	Resistencia
2	1	PRS_SAENZ	Presidencia Roque Sáenz Peña
3	1	JJC	Juan José Castelli
4	1	VANGELA	Villa Ángela
5	1	CHARATA	Charata
6	2	CORRIENTES	Corrientes
7	2	GOYA	Goya
8	2	PAS_LIBRES	Paso de los Libres
9	2	CURUZUCUAT	Curuzú Cuatiá
10	2	MERCEDES	Mercedes
11	3	FORMOSA	Formosa
12	3	CLORINDA	Clorinda
13	3	PIRANE	Pirané
14	4	POSADAS	Posadas
15	4	OBERA	Oberá
16	4	ELDORADO	Eldorado
17	4	GARUPA	Garupá
18	4	PT_IGUAZU	Puerto Iguazú
19	5	SANTAFE	Santa Fe de la Vera Cruz
20	5	ROSARIO	Rosario
21	5	RAFAELA	Rafaela
22	5	RECONQUIST	Reconquista
23	5	VILLACONS	Villa Constitución
24	6	ASUNCION	Asunción
25	6	SANLORENZ	San Lorenzo
26	6	FEDMORA	Fernando de la Mora
27	6	LAMBARA	Lambaré
28	6	LUQUE	Luque
29	6	MROQALON	Mariano Roque Alonso
\.
-- Data for Name: movement_type; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.movement_type (movement_type_id, code, description) FROM stdin;
1	INGRESO_PRODUCCION	Ingreso por producción
2	INGRESO_COMPRA_EXTERNA	Ingreso por compra externa
3	INGRESO_DEVOLUCION_COMODATO	Ingreso por devolución de comodato
4	AJUSTE_POSITIVO	Ajuste positivo de stock
5	TRANSFERENCIA_ENTRADA	Transferencia de entrada
6	EGRESO_VENTA_PRODUCTO	Egreso por venta de producto
7	EGRESO_ENTREGA_COMODATO	Egreso por entrega de comodato
8	AJUSTE_NEGATIVO	Ajuste negativo de stock
9	TRANSFERENCIA_SALIDA	Transferencia de salida
10	EGRESO_VENTA_UNICA	Egreso por venta única
11	INGRESO_DEVOLUCION_VENTA_UNICA	Ingreso por devolución de venta única
12	INGRESO_DEVOLUCION_VENTA_UNICA_CANCELADA	Ingreso por devolución de venta única cancelada
\.
-- Data for Name: one_off_purchase; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.one_off_purchase (purchase_id, person_id, product_id, quantity, total_amount, purchase_date, sale_channel_id, delivery_address, locality_id, zone_id) FROM stdin;
\.
-- Data for Name: order_header; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.order_header (order_id, customer_id, contract_id, sale_channel_id, order_date, scheduled_delivery_date, delivery_time, total_amount, paid_amount, notes, subscription_id, order_type, status) FROM stdin;
\.
-- Data for Name: order_item; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.order_item (order_item_id, order_id, product_id, quantity, subtotal, delivered_quantity, returned_quantity, amount_paid, total_amount) FROM stdin;
\.
-- Data for Name: payment_installment; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.payment_installment (installment_id, customer_id, due_date, delivered_quantity, amount_paid, total_amount) FROM stdin;
\.
-- Data for Name: payment_line; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.payment_line (payment_line_id, transaction_id, product_id, quantity, unit_price, subtotal, notes) FROM stdin;
\.
-- Data for Name: payment_method; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.payment_method (payment_method_id, code, description) FROM stdin;
\.
-- Data for Name: payment_transaction; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.payment_transaction (transaction_id, transaction_date, customer_id, order_id, document_number, receipt_number, transaction_type, previous_balance, transaction_amount, total, payment_method_id, notes, user_id) FROM stdin;
\.
-- Data for Name: person; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.person (person_id, phone, name, tax_id, address, locality_id, zone_id, registration_date, type, alias) FROM stdin;
1	123123123	Matias	20364567653	peredo 123	1	2	2025-07-04	PLAN	\N
4	362412233423	Facundo	20234564564	av 25 de mayo 1234	1	2	2025-07-05	INDIVIDUAL	\N
5	15345334534512	juancito	20652344564	av.libre 1234	1	2	2025-07-05	INDIVIDUAL	\N
7	34234234234	migueleto	20534535324	sdfsdfo234	1	2	2025-07-05	INDIVIDUAL	Migueleto Kiosco
6	456434534	josecito	204556445644	av. 9 de julio 1050	1	2	2025-07-05	PLAN	Colombraro
\.
-- Data for Name: price_list; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.price_list (price_list_id, name, effective_date, active, created_at, description, is_default, updated_at) FROM stdin;
2	Mayoristas	2025-07-05	t	2025-07-05 16:57:12.206	Lista de precio Mayoristas	f	2025-07-05 16:57:12.206
1	Lista General/Estándar	2025-07-04	t	2025-07-04 22:39:46.663	Lista de precios General Inicial	t	2025-07-05 16:58:19.191
\.
-- Data for Name: price_list_history; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.price_list_history (history_id, price_list_item_id, previous_price, new_price, change_date, change_percentage, change_reason, created_by) FROM stdin;
2	2	15000.00	16500.00	2025-07-04 22:54:54.435	10.00	inflacion julio	\N
3	3	500.00	550.00	2025-07-04 22:54:54.446	10.00	inflacion julio	\N
\.
-- Data for Name: price_list_item; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.price_list_item (price_list_item_id, price_list_id, product_id, unit_price) FROM stdin;
2	1	2	16500.00
3	1	3	550.00
4	1	1	5000.00
6	2	3	300.00
7	2	2	200.00
\.
-- Data for Name: product; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.product (product_id, category_id, description, volume_liters, price, is_returnable, serial_number, notes, image_url) FROM stdin;
1	1	Bidon 12LTS	12.00	1000.00	t	123	Bidon 12LTS retornable	\N
2	2	Dispenser Agua Fria	0.00	15000.00	f	123	Dispenser Agua Fria	\N
3	1	Bidon 5LTS	5.00	500.00	t	123	Bidon 5LTS retornable	\N
\.
-- Data for Name: product_category; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.product_category (category_id, name) FROM stdin;
1	Bidones
2	Dispensers
\.
-- Data for Name: province; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.province (province_id, country_id, code, name) FROM stdin;
1	1	CH	Chaco
2	1	CO	Corrientes
3	1	FO	Formosa
4	1	MI	Misiones
5	1	SF	Santa Fe
6	2	DC	Distrito Capital
\.
-- Data for Name: route_optimization; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.route_optimization (optimization_id, route_sheet_id, created_at, estimated_duration, estimated_distance, optimization_status, waypoints) FROM stdin;
\.
-- Data for Name: route_sheet; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.route_sheet (route_sheet_id, driver_id, vehicle_id, delivery_date, route_notes, driver_reconciliation_signature_path, reconciliation_at) FROM stdin;
\.
-- Data for Name: route_sheet_detail; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.route_sheet_detail (route_sheet_detail_id, route_sheet_id, order_id, delivery_status, delivery_time, comments, digital_signature_id, actual_arrival_time, delivery_notes, estimated_arrival_time, lat, lng, recipient_name, rejection_reason, reschedule_date, sequence_number) FROM stdin;
\.
-- Data for Name: sale_channel; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.sale_channel (sale_channel_id, code, description) FROM stdin;
1	PRESENCIAL	Venta presencial en local
2	WHATSAPP	Venta realizada por WhatsApp
\.
-- Data for Name: stock_movement; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.stock_movement (stock_movement_id, movement_date, movement_type_id, product_id, source_warehouse_id, destination_warehouse_id, quantity, remarks, order_id, reference_document, user_id) FROM stdin;
1	2025-07-04 22:39:46.779	1	1	\N	1	100	Stock inicial - Bidon 12LTS	\N	\N	\N
2	2025-07-04 22:40:17.834	1	2	\N	1	50	Stock inicial - Dispenser Agua Fria	\N	\N	\N
3	2025-07-04 22:40:46.717	1	3	\N	1	100	Stock inicial - Bidon 5LTS	\N	\N	\N
\.
-- Data for Name: subscription_cycle; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.subscription_cycle (cycle_id, subscription_id, cycle_start, cycle_end, notes) FROM stdin;
\.
-- Data for Name: subscription_cycle_detail; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.subscription_cycle_detail (cycle_detail_id, cycle_id, product_id, planned_quantity, delivered_quantity, remaining_balance) FROM stdin;
\.
-- Data for Name: subscription_delivery_schedule; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.subscription_delivery_schedule (schedule_id, subscription_id, day_of_week, scheduled_time) FROM stdin;
1	1	1	09:00-12:00
2	1	3	09:00-12:00
3	1	5	09:00-12:00
4	2	2	10:30-14:01
5	2	4	10:30-14:01
6	2	6	10:30-14:01
7	3	1	15:20-18:24
8	3	3	15:20-18:24
9	3	2	15:20-18:24
10	4	4	10:43
\.
-- Data for Name: subscription_plan; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.subscription_plan (subscription_plan_id, name, description, price, created_at, default_cycle_days, default_deliveries_per_cycle, is_active, updated_at) FROM stdin;
2	Abono quincenal	Abono Quincenal	2000.00	2025-07-05 22:43:34.164	15	2	t	2025-07-05 22:43:34.164
1	Abono Mensual 12 LTS	Abono Mensual	12000.00	2025-07-04 22:36:35.244	30	1	t	2025-07-07 19:17:19.872
\.
-- Data for Name: subscription_plan_product; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.subscription_plan_product (spp_id, subscription_plan_id, product_id, product_quantity) FROM stdin;
1	1	1	6
2	1	2	1
3	2	3	3
5	2	2	1
\.
-- Data for Name: user_vehicle; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.user_vehicle (user_vehicle_id, user_id, vehicle_id, assigned_at, is_active, notes) FROM stdin;
\.
-- Data for Name: vehicle; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.vehicle (vehicle_id, code, name, description) FROM stdin;
1	TRK-001	Merccedes Benz	Camion de carga
\.
-- Data for Name: vehicle_inventory; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.vehicle_inventory (vehicle_id, product_id, quantity_loaded, quantity_empty) FROM stdin;
\.
-- Data for Name: vehicle_route_inventory; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.vehicle_route_inventory (inventory_id, route_sheet_id, product_id, initial_quantity, current_quantity, returned_quantity) FROM stdin;
\.
-- Data for Name: vehicle_zone; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.vehicle_zone (vehicle_zone_id, vehicle_id, zone_id, assigned_at, is_active, notes) FROM stdin;
1	1	1	2025-07-04 22:45:00.829	t	Asignación para ruta matutina
\.
-- Data for Name: warehouse; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.warehouse (warehouse_id, name, locality_id) FROM stdin;
1	Central	\N
\.
-- Data for Name: zone; Type: TABLE DATA; Schema: public; Owner: postgres

COPY public.zone (zone_id, code, name, locality_id) FROM stdin;
1	ZS-001	Zona Sur	1
2	ZN-res	Zona Norte	1
\.

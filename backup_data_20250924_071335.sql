--
-- PostgreSQL database dump
--

-- Dumped from database version 16.3 (Debian 16.3-1.pgdg120+1)
-- Dumped by pg_dump version 16.3 (Debian 16.3-1.pgdg120+1)

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

--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public."User" VALUES (1, 'admin@gmail.com', '$2b$10$He27fDZZfM2TpuKgp6ph/OE0jN856AjDCSH6YwfPfLHLnwqCaKCom', 'Administrador General', 'SUPERADMIN', true, true, NULL, NULL, '2025-09-22 21:48:48.525', NULL, NULL, NULL, NULL);
INSERT INTO public."User" VALUES (2, 'zeniquelrober@gmail.com', '$2b$10$JgWonprcjO3rqOhwcoGCjuKzDFJjD.jDz/p0y895OsS8HAxfDGr4m', 'Rober Zeniquel', 'SUPERADMIN', true, false, 'a5521ad02b15817a05c48b97a13c325a360e41b34f833e07b44c4315f2d5f627', '2025-09-24 16:16:09.307', '2025-09-23 16:16:09.297', '2025-09-23 16:16:25.423', NULL, NULL, '160091330_10219357920358874_4369440607886377941_n-d078.jpg');
INSERT INTO public."User" VALUES (3, 'chofer1@gmail.com', '$2b$10$Y2/i/MlzM6t0oPhRP8McfOsC0758PLUhOh1e.m1MNIbtiHvaHzO9y', 'Chofer 1', 'DRIVERS', true, false, 'eac1445b63fbeb9571f76ff9b152c59846db9c75369f9ccd6dce81965eb36ca6', '2025-09-24 16:17:53.769', '2025-09-23 16:17:53.764', NULL, NULL, NULL, NULL);
INSERT INTO public."User" VALUES (4, 'chofer2@gmail.com', '$2b$10$8lDZsrjuqjnji7sLd1y/wuxVQZMFzGNbq/PqAKuqLQekXwO.yluX2', 'Chofer 2', 'DRIVERS', true, false, '3d3f6d752d6b74fd82c9fb8336222723cda95f8788851d38f01ee9e584112c3d', '2025-09-24 16:18:15.233', '2025-09-23 16:18:15.224', NULL, NULL, NULL, NULL);
INSERT INTO public."User" VALUES (5, 'chofer3@gmail.com', '$2b$10$iem8ONP5nTTuMiR9/wTwI.XQHRecYe6dL/G.sbPAvNwQomQtD14Ke', 'Chofer 3', 'DRIVERS', true, false, '44f4e8605180facda93438ecd72befd215d02a4c0be161c10fc7747de2e5ee9b', '2025-09-24 16:31:36.754', '2025-09-23 16:31:36.746', NULL, NULL, NULL, NULL);


--
-- Data for Name: RefreshToken; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public."RefreshToken" VALUES (1, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzU4NTc3OTIyLCJleHAiOjE3NTkxODI3MjJ9.F0V9o8TEkfY-9-WNXw9j9jBgc-ypxCqFAmhFu1Qxlyk', 1, '2025-09-29 21:52:02.973', '2025-09-22 21:52:02.975');
INSERT INTO public."RefreshToken" VALUES (2, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzU4NjQzODgxLCJleHAiOjE3NTkyNDg2ODF9.ftBJunhS-A6e2RI7Qdwdt9gXayMXQB1wt95jWEBCCvU', 1, '2025-09-30 16:11:21.03', '2025-09-23 16:11:21.032');
INSERT INTO public."RefreshToken" VALUES (3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiaWF0IjoxNzU4NjQ0MTY5LCJleHAiOjE3NTkyNDg5Njl9.3DeRFBbqsevffqcsz8WB02lJDDfJj_U-nF_aZd84_N0', 2, '2025-09-30 16:16:09.332', '2025-09-23 16:16:09.333');
INSERT INTO public."RefreshToken" VALUES (4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiaWF0IjoxNzU4NjQ0MjEyLCJleHAiOjE3NTkyNDkwMTJ9.A45KINebGGxSzaC196T6wOOKNpo_C3bN-YWi1nOaCsA', 2, '2025-09-30 16:16:52.404', '2025-09-23 16:16:52.406');
INSERT INTO public."RefreshToken" VALUES (5, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MywiaWF0IjoxNzU4NjQ0MjczLCJleHAiOjE3NTkyNDkwNzN9.OBhNdB05GVrQa6HmsgaBEgqjfZBcJFGrNJp2Cfe35sQ', 3, '2025-09-30 16:17:53.778', '2025-09-23 16:17:53.78');
INSERT INTO public."RefreshToken" VALUES (6, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwiaWF0IjoxNzU4NjQ0Mjk1LCJleHAiOjE3NTkyNDkwOTV9.NbMH5b17sQE14423xzZHvDBrW40-FiZmfhhaB9cgNc0', 4, '2025-09-30 16:18:15.239', '2025-09-23 16:18:15.24');
INSERT INTO public."RefreshToken" VALUES (7, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NSwiaWF0IjoxNzU4NjQ1MDk2LCJleHAiOjE3NTkyNDk4OTZ9.9H17ZaY_WIui5-6jcM0v5YiIR48HaN-MjEy6GgsgpcI', 5, '2025-09-30 16:31:36.765', '2025-09-23 16:31:36.766');
INSERT INTO public."RefreshToken" VALUES (8, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiaWF0IjoxNzU4NjQ2ODk1LCJleHAiOjE3NTkyNTE2OTV9.cRjGh4f7Db-kiyjzArVwn6tvD1E0Foc22J19n1n3Fsk', 2, '2025-09-30 17:01:35.761', '2025-09-23 17:01:35.762');
INSERT INTO public."RefreshToken" VALUES (9, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiaWF0IjoxNzU4Njc2ODU4LCJleHAiOjE3NTkyODE2NTh9.IC1ChWuVyaVi6EtLVNPQhOmyumq4AQCE_dkMM1oLM-Y', 2, '2025-10-01 01:20:58.453', '2025-09-24 01:20:58.454');
INSERT INTO public."RefreshToken" VALUES (10, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiaWF0IjoxNzU4Njc3NDExLCJleHAiOjE3NTkyODIyMTF9.7YMPH5ujDNNjDJc3iGWR4NmVNeL6ysA5VvrvQ1tHSo4', 2, '2025-10-01 01:30:11.522', '2025-09-24 01:30:11.523');
INSERT INTO public."RefreshToken" VALUES (11, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiaWF0IjoxNzU4Njg2MzkxLCJleHAiOjE3NTkyOTExOTF9.UQ9PolmUAwQ0ExZRVUHG9zGJr9Q3mX1sNpcdvFexh-8', 2, '2025-10-01 03:59:51.087', '2025-09-24 03:59:51.088');


--
-- Data for Name: country; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.country VALUES (1, 'AR', 'Argentina');
INSERT INTO public.country VALUES (2, 'PY', 'Paraguay');


--
-- Data for Name: province; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.province VALUES (1, 1, 'CH', 'Chaco');
INSERT INTO public.province VALUES (2, 1, 'CO', 'Corrientes');
INSERT INTO public.province VALUES (3, 1, 'FO', 'Formosa');
INSERT INTO public.province VALUES (4, 1, 'MI', 'Misiones');
INSERT INTO public.province VALUES (5, 1, 'SF', 'Santa Fe');
INSERT INTO public.province VALUES (6, 2, 'DC', 'Distrito Capital');


--
-- Data for Name: locality; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.locality VALUES (1, 1, 'RES', 'Resistencia');
INSERT INTO public.locality VALUES (2, 1, 'PRS_SAENZ', 'Presidencia Roque Sáenz Peña');
INSERT INTO public.locality VALUES (3, 1, 'JJC', 'Juan José Castelli');
INSERT INTO public.locality VALUES (4, 1, 'VANGELA', 'Villa Ángela');
INSERT INTO public.locality VALUES (5, 1, 'CHARATA', 'Charata');
INSERT INTO public.locality VALUES (6, 2, 'CORRIENTES', 'Corrientes');
INSERT INTO public.locality VALUES (7, 2, 'GOYA', 'Goya');
INSERT INTO public.locality VALUES (8, 2, 'PAS_LIBRES', 'Paso de los Libres');
INSERT INTO public.locality VALUES (9, 2, 'CURUZUCUAT', 'Curuzú Cuatiá');
INSERT INTO public.locality VALUES (10, 2, 'MERCEDES', 'Mercedes');
INSERT INTO public.locality VALUES (11, 3, 'FORMOSA', 'Formosa');
INSERT INTO public.locality VALUES (12, 3, 'CLORINDA', 'Clorinda');
INSERT INTO public.locality VALUES (13, 3, 'PIRANE', 'Pirané');
INSERT INTO public.locality VALUES (14, 4, 'POSADAS', 'Posadas');
INSERT INTO public.locality VALUES (15, 4, 'OBERA', 'Oberá');
INSERT INTO public.locality VALUES (16, 4, 'ELDORADO', 'Eldorado');
INSERT INTO public.locality VALUES (17, 4, 'GARUPA', 'Garupá');
INSERT INTO public.locality VALUES (18, 4, 'PT_IGUAZU', 'Puerto Iguazú');
INSERT INTO public.locality VALUES (19, 5, 'SANTAFE', 'Santa Fe de la Vera Cruz');
INSERT INTO public.locality VALUES (20, 5, 'ROSARIO', 'Rosario');
INSERT INTO public.locality VALUES (21, 5, 'RAFAELA', 'Rafaela');
INSERT INTO public.locality VALUES (22, 5, 'RECONQUIST', 'Reconquista');
INSERT INTO public.locality VALUES (23, 5, 'VILLACONS', 'Villa Constitución');
INSERT INTO public.locality VALUES (24, 6, 'ASUNCION', 'Asunción');
INSERT INTO public.locality VALUES (25, 6, 'SANLORENZ', 'San Lorenzo');
INSERT INTO public.locality VALUES (26, 6, 'FEDMORA', 'Fernando de la Mora');
INSERT INTO public.locality VALUES (27, 6, 'LAMBARA', 'Lambaré');
INSERT INTO public.locality VALUES (28, 6, 'LUQUE', 'Luque');
INSERT INTO public.locality VALUES (29, 6, 'MROQALON', 'Mariano Roque Alonso');
INSERT INTO public.locality VALUES (30, 1, 'FONTANA', 'Fontana');
INSERT INTO public.locality VALUES (31, 1, 'BARQUERAS', 'Barranqueras');


--
-- Data for Name: zone; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.zone VALUES (2, 'res-1', 'Zona 1', 1);
INSERT INTO public.zone VALUES (3, 'res-2', 'Zona 2', 1);
INSERT INTO public.zone VALUES (4, 'res-3', 'Zona 3', 1);
INSERT INTO public.zone VALUES (5, 'res-4', 'Zona 4', 31);


--
-- Data for Name: person; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.person VALUES (1, '3624565645', '3624874598 3624984567', NULL, 'Diego Alvarez', '20-37456234-4', 'vedia 1415', 1, 2, '2025-09-23', 'PLAN', 'el dorado', '', true, false);
INSERT INTO public.person VALUES (3, '3624675694', '', NULL, 'Martin Garcia', '20-37098567-4', 'av 25 de mayo 456', 31, 5, '2025-09-23', 'PLAN', 'komsa', '', true, false);
INSERT INTO public.person VALUES (2, '3624456432', '3624092367', NULL, 'Matias Garcia', '20-37456345-4', 'av sarmiento 300', 1, 3, '2025-09-23', 'PLAN', 'Llano Studio', '', true, false);
INSERT INTO public.person VALUES (4, '3624596879', '', NULL, 'Renzo Zeniquel', '', 'necochea 1530', 1, 2, '2025-09-23', 'INDIVIDUAL', 'Travel Rock', '', true, false);
INSERT INTO public.person VALUES (5, '3624527635', NULL, NULL, 'Facundo Zeniquel', '', 'goitia 1214', 1, 3, '2025-09-24', 'INDIVIDUAL', '', NULL, true, false);


--
-- Data for Name: subscription_plan; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.subscription_plan VALUES (1, 'Abono 6x 20LTS', 'Abono 6 Bidones 20LTS y un dispenser agua frio calor', 10000.00, '2025-09-23 17:08:59.41', 30, 2, true, '2025-09-23 17:10:07.327');
INSERT INTO public.subscription_plan VALUES (2, 'Abono 6x 12LTS', 'Abono 6 bidones de 12LTS y un dispenser agua frio calor', 7000.00, '2025-09-23 17:09:48.13', 30, 2, true, '2025-09-23 17:10:53.454');


--
-- Data for Name: customer_subscription; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.customer_subscription VALUES (1, 5, 1, '2025-09-24', NULL, 'ACTIVE', '{"delivery_preferences":{"special_instructions":"timbre 204","preferred_days":["MONDAY","WEDNESDAY","FRIDAY"],"preferred_time_range":"08:00-12:00","avoid_times":["15:00-18:00"]}}', NULL, NULL, NULL, false, true);
INSERT INTO public.customer_subscription VALUES (2, 5, 1, '2025-09-24', NULL, 'ACTIVE', '{"delivery_preferences":{"special_instructions":"timbre 505","preferred_days":["TUESDAY","THURSDAY"],"preferred_time_range":"10:00-13:00","avoid_times":["14:00-20:00"]}}', NULL, NULL, NULL, false, true);
INSERT INTO public.customer_subscription VALUES (3, 5, 2, '2025-09-24', NULL, 'ACTIVE', '{"delivery_preferences":{"special_instructions":"timbre 204","preferred_days":["MONDAY","WEDNESDAY","FRIDAY"],"preferred_time_range":"08:00-12:00","avoid_times":["15:00-18:00"]}}', NULL, NULL, NULL, false, true);
INSERT INTO public.customer_subscription VALUES (4, 3, 1, '2025-09-24', NULL, 'CANCELLED', '{"delivery_preferences":{"special_instructions":"timbre 304","preferred_days":["MONDAY","WEDNESDAY","FRIDAY"],"preferred_time_range":"08:00-12:00","avoid_times":["15:00-18:00"]}}', NULL, '2025-10-23', NULL, false, true);
INSERT INTO public.customer_subscription VALUES (5, 3, 1, '2025-09-24', NULL, 'ACTIVE', '{"delivery_preferences":{"special_instructions":"timbre 206","preferred_days":["MONDAY","WEDNESDAY","FRIDAY"],"preferred_time_range":"08:00-12:00","avoid_times":["15:00-18:00"]}}', NULL, NULL, NULL, false, true);


--
-- Data for Name: vehicle; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.vehicle VALUES (1, 'abs-345', 'Movil 1', 'Camion Mercedes Benz');
INSERT INTO public.vehicle VALUES (2, 'sdf-543', 'Movil 2', 'Camion Fiat');
INSERT INTO public.vehicle VALUES (3, 'kjh-234', 'Movil 3', 'Camion Volvo');


--
-- Data for Name: route_sheet; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: cancellation_order; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.cancellation_order VALUES (1, 4, '2025-10-01', NULL, 'PENDING', NULL, 'Orden de cancelación generada automáticamente para suscripción 4', '2025-09-24 02:01:48.875', '2025-09-24 02:01:48.875', 0);


--
-- Data for Name: price_list; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.price_list VALUES (2, 'Lista Mayorista', '2025-09-23', true, '2025-09-24 01:23:08.308', 'Lista de precios Mayorista', false, '2025-09-24 01:23:08.308', true);
INSERT INTO public.price_list VALUES (1, 'Lista General/Estándar', '2024-01-01', true, '2025-09-22 21:48:48.543', 'Lista de precios estándar del sistema', true, '2025-09-24 01:52:03.386', true);


--
-- Data for Name: client_contract; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: product_category; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.product_category VALUES (1, 'Bidones');
INSERT INTO public.product_category VALUES (2, 'Dispensers');


--
-- Data for Name: product; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.product VALUES (1, 1, 'Bidon 20 LTS', 20.00, 2000.00, true, '123123', 'Bidon 20 LTS retornable', 'bidon-poli-20-pag-1402.jpg', true);
INSERT INTO public.product VALUES (2, 1, 'Bidon 12 LTS', 12.00, 1500.00, true, '123345', 'Bidon 12 LTS retornable', 'producto_bidon_foto-5-6b3a.jpg', true);
INSERT INTO public.product VALUES (4, 1, 'Bidon 3 LTS', 3.00, 500.00, true, '123', 'Bidon 3 LTS descartable', NULL, true);
INSERT INTO public.product VALUES (5, 2, 'Dispenser Agua Frio Calor', 0.00, 200000.00, true, '123345', 'Dispenser Agua Frio Calor para comodato', '93d9bb0d054b43b6e4c9b3ad24607b7470a32aaab4bc25f3e27f305be24ed9b963845-366e.jpg', true);
INSERT INTO public.product VALUES (3, 1, 'Bidon 7 LTS', 7.00, 1200.00, true, '456678', 'Bidon 7 LTS descartable', 'Captura desde 2025-09-23 13-59-07-b8f7.png', true);
INSERT INTO public.product VALUES (6, 1, 'Botella 1000cc', 1.00, 1000.00, true, '123', 'Botella 500cc descartable', 'MG_0161imlogo_111-5782.png', true);


--
-- Data for Name: comodato; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.comodato VALUES (3, 5, 2, 3, 6, '2025-09-24', NULL, '2026-09-24', 'ACTIVE', 'Comodato automático - Primer ciclo de suscripción 3 - Suscripción ID: 3', NULL, NULL, 'Bidon 12 LTS', NULL, NULL, NULL, '2025-09-24 01:36:36.745', '2025-09-24 01:36:36.745', true);
INSERT INTO public.comodato VALUES (2, 5, 5, 1, 1, '2025-09-24', NULL, '2026-09-24', 'ACTIVE', 'Comodato automático - Primer ciclo de suscripción 1 - Suscripción ID: 1', 0.00, 0.00, '', 'Samsung', 'san-102', '[object File]', '2025-09-24 01:29:08.798', '2025-09-24 01:41:52.815', true);
INSERT INTO public.comodato VALUES (1, 5, 1, 1, 6, '2025-09-24', NULL, '2026-09-24', 'ACTIVE', 'Comodato automático - Primer ciclo de suscripción 1 - Suscripción ID: 1', 0.00, 0.00, '', '', '', '[object File]', '2025-09-24 01:29:08.78', '2025-09-24 01:45:12.848', true);
INSERT INTO public.comodato VALUES (4, 3, 1, 4, 6, '2025-09-24', NULL, '2025-10-01', 'ACTIVE', 'Comodato automático - Primer ciclo de suscripción 4 - Suscripción ID: 4', NULL, NULL, 'Bidon 20 LTS', NULL, NULL, NULL, '2025-09-24 01:59:33.928', '2025-09-24 02:01:49.007', true);
INSERT INTO public.comodato VALUES (5, 3, 5, 4, 1, '2025-09-24', NULL, '2025-10-01', 'ACTIVE', 'Comodato automático - Primer ciclo de suscripción 4 - Suscripción ID: 4', NULL, NULL, 'Dispenser Agua Frio Calor', NULL, NULL, NULL, '2025-09-24 01:59:33.936', '2025-09-24 02:01:49.019', true);


--
-- Data for Name: comodato_change; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: contract_delivery_schedule; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: subscription_cycle; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.subscription_cycle VALUES (1, 1, 1, '2025-09-24', '2025-10-23', '2025-11-02', false, false, NULL, NULL, 10000.00, 0.00, 10000.00, 0.00, 'PENDING');
INSERT INTO public.subscription_cycle VALUES (2, 2, 1, '2025-09-24', '2025-10-23', '2025-11-02', false, false, NULL, NULL, 10000.00, 0.00, 10000.00, 0.00, 'PENDING');
INSERT INTO public.subscription_cycle VALUES (3, 3, 1, '2025-09-24', '2025-10-23', '2025-11-02', false, false, NULL, NULL, 7000.00, 0.00, 7000.00, 0.00, 'PENDING');
INSERT INTO public.subscription_cycle VALUES (4, 4, 1, '2025-09-24', '2025-10-23', '2025-11-02', false, false, NULL, NULL, 10000.00, 0.00, 10000.00, 0.00, 'PENDING');
INSERT INTO public.subscription_cycle VALUES (5, 5, 1, '2025-09-24', '2025-10-23', '2025-11-02', false, false, NULL, NULL, 10000.00, 10000.00, 0.00, 6200.00, 'CREDITED');


--
-- Data for Name: cycle_payment; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.cycle_payment VALUES (1, 5, '2025-09-23 10:30:00', 16200.00, 'EFECTIVO', 'TRANS-001234', 'Pago correspondiente al ciclo de septiembre 2025', NULL);


--
-- Data for Name: sale_channel; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.sale_channel VALUES (1, 'WEB', 'Ventas a través de la página web');
INSERT INTO public.sale_channel VALUES (2, 'WHATSAPP', 'Ventas a través de WhatsApp');


--
-- Data for Name: one_off_purchase; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: one_off_purchase_header; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.one_off_purchase_header VALUES (1, 5, 1, '2025-09-24 00:00:00', 10000.00, 10000.00, 'goitia 1214', 1, 3, NULL, 'avisar antes', 'PENDING', 'PENDING', 'PENDING', '2025-09-24 01:27:34.648', '2025-09-24 01:27:34.648', '2025-09-24 00:00:00', '08:00-12:00');


--
-- Data for Name: order_header; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: route_sheet_detail; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: delivery_evidence; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: delivery_incident; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: delivery_stats; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: order_item; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: payment_installment; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: installment_order_link; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: warehouse; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.warehouse VALUES (1, 'Almacén Principal', 1);


--
-- Data for Name: inventory; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.inventory VALUES (1, 1, 100);
INSERT INTO public.inventory VALUES (1, 2, 100);
INSERT INTO public.inventory VALUES (1, 3, 100);
INSERT INTO public.inventory VALUES (1, 4, 100);
INSERT INTO public.inventory VALUES (1, 5, 100);
INSERT INTO public.inventory VALUES (1, 6, 100);


--
-- Data for Name: inventory_transaction; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: movement_type; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.movement_type VALUES (1, 'EGR_VENTA', 'Egreso por venta de producto');
INSERT INTO public.movement_type VALUES (2, 'EGR_V_UNI', 'Egreso por venta única');
INSERT INTO public.movement_type VALUES (3, 'EGR_COMOD', 'Egreso por entrega en comodato');
INSERT INTO public.movement_type VALUES (4, 'AJ_NEG', 'Ajuste negativo de inventario');
INSERT INTO public.movement_type VALUES (5, 'TRANS_SAL', 'Transferencia de salida');
INSERT INTO public.movement_type VALUES (6, 'ING_DEV_PC', 'Ingreso por devolución de pedido cancelado');
INSERT INTO public.movement_type VALUES (7, 'ING_DEV_CL', 'Ingreso por devolución de cliente');
INSERT INTO public.movement_type VALUES (8, 'ING_DV_VU', 'Ingreso por devolución de venta única');
INSERT INTO public.movement_type VALUES (9, 'ING_DV_VUC', 'Ingreso por devolución de venta única cancelada');
INSERT INTO public.movement_type VALUES (10, 'ING_PROD', 'Ingreso por producción');
INSERT INTO public.movement_type VALUES (11, 'ING_COMP', 'Ingreso por compra externa');
INSERT INTO public.movement_type VALUES (12, 'ING_DV_COM', 'Ingreso por devolución de comodato');
INSERT INTO public.movement_type VALUES (13, 'AJ_POS', 'Ajuste positivo de inventario');
INSERT INTO public.movement_type VALUES (14, 'TRANS_ENT', 'Transferencia de entrada');
INSERT INTO public.movement_type VALUES (15, 'ING_DEV_CS', 'Ingreso dev. cancelación');


--
-- Data for Name: one_off_purchase_item; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.one_off_purchase_item VALUES (1, 1, 2, 2, 1500.00, 3000.00, NULL, 1);
INSERT INTO public.one_off_purchase_item VALUES (2, 1, 3, 2, 1200.00, 2400.00, NULL, 1);
INSERT INTO public.one_off_purchase_item VALUES (3, 1, 3, 2, 1000.00, 2000.00, NULL, 2);
INSERT INTO public.one_off_purchase_item VALUES (4, 1, 2, 2, 1300.00, 2600.00, NULL, 2);


--
-- Data for Name: payment_method; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: payment_transaction; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: payment_line; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: price_list_item; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.price_list_item VALUES (1, 1, 1, 2000.00);
INSERT INTO public.price_list_item VALUES (2, 1, 2, 1500.00);
INSERT INTO public.price_list_item VALUES (4, 1, 4, 500.00);
INSERT INTO public.price_list_item VALUES (5, 1, 5, 200000.00);
INSERT INTO public.price_list_item VALUES (6, 2, 2, 1300.00);
INSERT INTO public.price_list_item VALUES (7, 2, 1, 1700.00);
INSERT INTO public.price_list_item VALUES (8, 2, 4, 300.00);
INSERT INTO public.price_list_item VALUES (9, 2, 3, 1000.00);
INSERT INTO public.price_list_item VALUES (10, 2, 5, 150000.00);
INSERT INTO public.price_list_item VALUES (3, 1, 3, 1200.00);
INSERT INTO public.price_list_item VALUES (11, 1, 6, 1000.00);


--
-- Data for Name: price_list_history; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: recovery_order; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.recovery_order VALUES (1, 4, '2025-10-01', NULL, 'PENDING', 'Orden de recuperación generada automáticamente por cancelación de suscripción 4', '2025-09-24 02:01:49.001', '2025-09-24 02:01:49.001');
INSERT INTO public.recovery_order VALUES (2, 5, '2025-10-01', NULL, 'PENDING', 'Orden de recuperación generada automáticamente por cancelación de suscripción 4', '2025-09-24 02:01:49.017', '2025-09-24 02:01:49.017');


--
-- Data for Name: route_optimization; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: stock_movement; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.stock_movement VALUES (1, '2025-09-23 16:56:41.311', 10, 1, NULL, 1, 100, 'Stock inicial - Bidon 20 LTS', NULL, NULL, NULL);
INSERT INTO public.stock_movement VALUES (2, '2025-09-23 16:58:03.9', 10, 2, NULL, 1, 100, 'Stock inicial - Bidon 12 LTS', NULL, NULL, NULL);
INSERT INTO public.stock_movement VALUES (3, '2025-09-23 16:59:46.245', 10, 3, NULL, 1, 100, 'Stock inicial - Bidon 7 LTS', NULL, NULL, NULL);
INSERT INTO public.stock_movement VALUES (4, '2025-09-23 17:03:05.32', 10, 4, NULL, 1, 100, 'Stock inicial - Bidon 3 LTS', NULL, NULL, NULL);
INSERT INTO public.stock_movement VALUES (5, '2025-09-23 17:07:47.506', 10, 5, NULL, 1, 100, 'Stock inicial - Dispenser Agua Frio Calor', NULL, NULL, NULL);
INSERT INTO public.stock_movement VALUES (6, '2025-09-24 01:52:03.455', 10, 6, NULL, 1, 100, 'Stock inicial - Botella 1000cc', NULL, NULL, NULL);


--
-- Data for Name: subscription_cycle_detail; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.subscription_cycle_detail VALUES (1, 1, 1, 6, 0, 6);
INSERT INTO public.subscription_cycle_detail VALUES (2, 1, 5, 1, 0, 1);
INSERT INTO public.subscription_cycle_detail VALUES (3, 2, 1, 6, 0, 6);
INSERT INTO public.subscription_cycle_detail VALUES (4, 2, 5, 1, 0, 1);
INSERT INTO public.subscription_cycle_detail VALUES (5, 3, 2, 6, 0, 6);
INSERT INTO public.subscription_cycle_detail VALUES (6, 3, 5, 1, 0, 1);
INSERT INTO public.subscription_cycle_detail VALUES (7, 4, 1, 6, 0, 6);
INSERT INTO public.subscription_cycle_detail VALUES (8, 4, 5, 1, 0, 1);
INSERT INTO public.subscription_cycle_detail VALUES (9, 5, 1, 6, 0, 6);
INSERT INTO public.subscription_cycle_detail VALUES (10, 5, 5, 1, 0, 1);


--
-- Data for Name: subscription_delivery_schedule; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.subscription_delivery_schedule VALUES (1, 1, 1, '08:00-12:00');
INSERT INTO public.subscription_delivery_schedule VALUES (2, 1, 3, '08:00-12:00');
INSERT INTO public.subscription_delivery_schedule VALUES (3, 1, 5, '08:00-12:00');
INSERT INTO public.subscription_delivery_schedule VALUES (4, 2, 2, '10:00-13:00');
INSERT INTO public.subscription_delivery_schedule VALUES (5, 2, 4, '10:00-13:00');
INSERT INTO public.subscription_delivery_schedule VALUES (6, 3, 1, '08:00-12:00');
INSERT INTO public.subscription_delivery_schedule VALUES (7, 3, 3, '08:00-12:00');
INSERT INTO public.subscription_delivery_schedule VALUES (8, 3, 5, '08:00-12:00');
INSERT INTO public.subscription_delivery_schedule VALUES (9, 4, 1, '08:00-12:00');
INSERT INTO public.subscription_delivery_schedule VALUES (10, 4, 3, '08:00-12:00');
INSERT INTO public.subscription_delivery_schedule VALUES (11, 4, 5, '08:00-12:00');
INSERT INTO public.subscription_delivery_schedule VALUES (12, 5, 1, '08:00-12:00');
INSERT INTO public.subscription_delivery_schedule VALUES (13, 5, 3, '08:00-12:00');
INSERT INTO public.subscription_delivery_schedule VALUES (14, 5, 5, '08:00-12:00');


--
-- Data for Name: subscription_plan_product; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.subscription_plan_product VALUES (1, 1, 1, 6);
INSERT INTO public.subscription_plan_product VALUES (2, 1, 5, 1);
INSERT INTO public.subscription_plan_product VALUES (3, 2, 2, 6);
INSERT INTO public.subscription_plan_product VALUES (4, 2, 5, 1);


--
-- Data for Name: user_vehicle; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.user_vehicle VALUES (1, 3, 1, '2025-09-23 16:28:40.614', true, '');
INSERT INTO public.user_vehicle VALUES (2, 4, 2, '2025-09-23 16:29:05.12', true, '');
INSERT INTO public.user_vehicle VALUES (3, 5, 3, '2025-09-23 16:31:53.767', true, '');


--
-- Data for Name: vehicle_inventory; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: vehicle_route_inventory; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: vehicle_zone; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.vehicle_zone VALUES (1, 1, 2, '2025-09-23 16:28:35.283', true, '');
INSERT INTO public.vehicle_zone VALUES (2, 2, 3, '2025-09-23 16:29:00.714', true, '');
INSERT INTO public.vehicle_zone VALUES (3, 3, 5, '2025-09-23 16:52:50.521', true, '');


--
-- Name: RefreshToken_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."RefreshToken_id_seq"', 11, true);


--
-- Name: User_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."User_id_seq"', 5, true);


--
-- Name: cancellation_order_cancellation_order_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.cancellation_order_cancellation_order_id_seq', 1, true);


--
-- Name: client_contract_contract_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.client_contract_contract_id_seq', 1, false);


--
-- Name: comodato_change_change_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.comodato_change_change_id_seq', 1, false);


--
-- Name: comodato_comodato_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.comodato_comodato_id_seq', 5, true);


--
-- Name: contract_delivery_schedule_schedule_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.contract_delivery_schedule_schedule_id_seq', 1, false);


--
-- Name: country_country_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.country_country_id_seq', 2, true);


--
-- Name: customer_subscription_subscription_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.customer_subscription_subscription_id_seq', 5, true);


--
-- Name: cycle_payment_payment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.cycle_payment_payment_id_seq', 1, true);


--
-- Name: delivery_evidence_evidence_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.delivery_evidence_evidence_id_seq', 1, false);


--
-- Name: delivery_incident_incident_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.delivery_incident_incident_id_seq', 1, false);


--
-- Name: delivery_stats_stat_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.delivery_stats_stat_id_seq', 1, false);


--
-- Name: installment_order_link_link_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.installment_order_link_link_id_seq', 1, false);


--
-- Name: inventory_transaction_transaction_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.inventory_transaction_transaction_id_seq', 1, false);


--
-- Name: locality_locality_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.locality_locality_id_seq', 31, true);


--
-- Name: movement_type_movement_type_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.movement_type_movement_type_id_seq', 15, true);


--
-- Name: one_off_purchase_header_purchase_header_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.one_off_purchase_header_purchase_header_id_seq', 1, true);


--
-- Name: one_off_purchase_item_purchase_item_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.one_off_purchase_item_purchase_item_id_seq', 4, true);


--
-- Name: one_off_purchase_purchase_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.one_off_purchase_purchase_id_seq', 1, false);


--
-- Name: order_header_order_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.order_header_order_id_seq', 1, false);


--
-- Name: order_item_order_item_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.order_item_order_item_id_seq', 1, false);


--
-- Name: payment_installment_installment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.payment_installment_installment_id_seq', 1, false);


--
-- Name: payment_line_payment_line_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.payment_line_payment_line_id_seq', 1, false);


--
-- Name: payment_method_payment_method_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.payment_method_payment_method_id_seq', 1, false);


--
-- Name: payment_transaction_transaction_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.payment_transaction_transaction_id_seq', 1, false);


--
-- Name: person_person_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.person_person_id_seq', 5, true);


--
-- Name: price_list_history_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.price_list_history_history_id_seq', 1, false);


--
-- Name: price_list_item_price_list_item_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.price_list_item_price_list_item_id_seq', 11, true);


--
-- Name: price_list_price_list_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.price_list_price_list_id_seq', 2, true);


--
-- Name: product_category_category_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.product_category_category_id_seq', 2, true);


--
-- Name: product_product_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.product_product_id_seq', 6, true);


--
-- Name: province_province_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.province_province_id_seq', 6, true);


--
-- Name: recovery_order_recovery_order_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.recovery_order_recovery_order_id_seq', 2, true);


--
-- Name: route_optimization_optimization_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.route_optimization_optimization_id_seq', 1, false);


--
-- Name: route_sheet_detail_route_sheet_detail_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.route_sheet_detail_route_sheet_detail_id_seq', 1, false);


--
-- Name: route_sheet_route_sheet_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.route_sheet_route_sheet_id_seq', 1, false);


--
-- Name: sale_channel_sale_channel_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.sale_channel_sale_channel_id_seq', 2, true);


--
-- Name: stock_movement_stock_movement_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.stock_movement_stock_movement_id_seq', 6, true);


--
-- Name: subscription_cycle_cycle_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.subscription_cycle_cycle_id_seq', 5, true);


--
-- Name: subscription_cycle_detail_cycle_detail_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.subscription_cycle_detail_cycle_detail_id_seq', 10, true);


--
-- Name: subscription_delivery_schedule_schedule_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.subscription_delivery_schedule_schedule_id_seq', 14, true);


--
-- Name: subscription_plan_product_spp_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.subscription_plan_product_spp_id_seq', 4, true);


--
-- Name: subscription_plan_subscription_plan_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.subscription_plan_subscription_plan_id_seq', 2, true);


--
-- Name: user_vehicle_user_vehicle_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_vehicle_user_vehicle_id_seq', 3, true);


--
-- Name: vehicle_route_inventory_inventory_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.vehicle_route_inventory_inventory_id_seq', 1, false);


--
-- Name: vehicle_vehicle_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.vehicle_vehicle_id_seq', 3, true);


--
-- Name: vehicle_zone_vehicle_zone_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.vehicle_zone_vehicle_zone_id_seq', 3, true);


--
-- Name: warehouse_warehouse_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.warehouse_warehouse_id_seq', 1, true);


--
-- Name: zone_zone_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.zone_zone_id_seq', 5, true);


--
-- PostgreSQL database dump complete
--


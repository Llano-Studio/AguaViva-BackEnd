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

INSERT INTO public."User" (id, email, password, name, role, "isActive", "isEmailConfirmed", "emailConfirmationToken", "emailTokenExpires", "createdAt", "updatedAt", "recoveryToken", "recoveryTokenExpires", "profileImageUrl") VALUES (1, 'admin@gmail.com', '$2b$10$WHuscyePQ5T.KwJehEtmHeTmKDzByHBrRGlJySdL./lvuZwVshj9u', 'Administrador General', 'SUPERADMIN', true, true, NULL, NULL, '2025-09-26 21:03:33.052', NULL, NULL, NULL, NULL);
INSERT INTO public."User" (id, email, password, name, role, "isActive", "isEmailConfirmed", "emailConfirmationToken", "emailTokenExpires", "createdAt", "updatedAt", "recoveryToken", "recoveryTokenExpires", "profileImageUrl") VALUES (2, 'zeniquelrober@gmail.com', '$2b$10$JgWonprcjO3rqOhwcoGCjuKzDFJjD.jDz/p0y895OsS8HAxfDGr4m', 'Rober Zeniquel', 'SUPERADMIN', true, false, 'a5521ad02b15817a05c48b97a13c325a360e41b34f833e07b44c4315f2d5f627', '2025-09-24 16:16:09.307', '2025-09-23 16:16:09.297', '2025-09-23 16:16:25.423', NULL, NULL, '160091330_10219357920358874_4369440607886377941_n-d078.jpg');
INSERT INTO public."User" (id, email, password, name, role, "isActive", "isEmailConfirmed", "emailConfirmationToken", "emailTokenExpires", "createdAt", "updatedAt", "recoveryToken", "recoveryTokenExpires", "profileImageUrl") VALUES (4, 'chofer2@gmail.com', '$2b$10$8lDZsrjuqjnji7sLd1y/wuxVQZMFzGNbq/PqAKuqLQekXwO.yluX2', 'Chofer 2', 'DRIVERS', true, false, '3d3f6d752d6b74fd82c9fb8336222723cda95f8788851d38f01ee9e584112c3d', '2025-09-24 16:18:15.233', '2025-09-23 16:18:15.224', NULL, NULL, NULL, NULL);
INSERT INTO public."User" (id, email, password, name, role, "isActive", "isEmailConfirmed", "emailConfirmationToken", "emailTokenExpires", "createdAt", "updatedAt", "recoveryToken", "recoveryTokenExpires", "profileImageUrl") VALUES (5, 'chofer3@gmail.com', '$2b$10$iem8ONP5nTTuMiR9/wTwI.XQHRecYe6dL/G.sbPAvNwQomQtD14Ke', 'Chofer 3', 'DRIVERS', true, false, '44f4e8605180facda93438ecd72befd215d02a4c0be161c10fc7747de2e5ee9b', '2025-09-24 16:31:36.754', '2025-09-23 16:31:36.746', NULL, NULL, NULL, NULL);
INSERT INTO public."User" (id, email, password, name, role, "isActive", "isEmailConfirmed", "emailConfirmationToken", "emailTokenExpires", "createdAt", "updatedAt", "recoveryToken", "recoveryTokenExpires", "profileImageUrl") VALUES (3, 'chofer1@gmail.com', '$2b$10$Y2/i/MlzM6t0oPhRP8McfOsC0758PLUhOh1e.m1MNIbtiHvaHzO9y', 'Chofer 1', 'SUPERADMIN', true, false, 'eac1445b63fbeb9571f76ff9b152c59846db9c75369f9ccd6dce81965eb36ca6', '2025-09-24 16:17:53.769', '2025-09-23 16:17:53.764', '2025-09-24 20:37:36.844', NULL, NULL, NULL);


--
-- Data for Name: RefreshToken; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public."RefreshToken" (id, token, "userId", "expiresAt", "createdAt") VALUES (1, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzU4NTc3OTIyLCJleHAiOjE3NTkxODI3MjJ9.F0V9o8TEkfY-9-WNXw9j9jBgc-ypxCqFAmhFu1Qxlyk', 1, '2025-09-29 21:52:02.973', '2025-09-22 21:52:02.975');
INSERT INTO public."RefreshToken" (id, token, "userId", "expiresAt", "createdAt") VALUES (2, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzU4NjQzODgxLCJleHAiOjE3NTkyNDg2ODF9.ftBJunhS-A6e2RI7Qdwdt9gXayMXQB1wt95jWEBCCvU', 1, '2025-09-30 16:11:21.03', '2025-09-23 16:11:21.032');
INSERT INTO public."RefreshToken" (id, token, "userId", "expiresAt", "createdAt") VALUES (3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiaWF0IjoxNzU4NjQ0MTY5LCJleHAiOjE3NTkyNDg5Njl9.3DeRFBbqsevffqcsz8WB02lJDDfJj_U-nF_aZd84_N0', 2, '2025-09-30 16:16:09.332', '2025-09-23 16:16:09.333');
INSERT INTO public."RefreshToken" (id, token, "userId", "expiresAt", "createdAt") VALUES (4, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiaWF0IjoxNzU4NjQ0MjEyLCJleHAiOjE3NTkyNDkwMTJ9.A45KINebGGxSzaC196T6wOOKNpo_C3bN-YWi1nOaCsA', 2, '2025-09-30 16:16:52.404', '2025-09-23 16:16:52.406');
INSERT INTO public."RefreshToken" (id, token, "userId", "expiresAt", "createdAt") VALUES (5, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MywiaWF0IjoxNzU4NjQ0MjczLCJleHAiOjE3NTkyNDkwNzN9.OBhNdB05GVrQa6HmsgaBEgqjfZBcJFGrNJp2Cfe35sQ', 3, '2025-09-30 16:17:53.778', '2025-09-23 16:17:53.78');
INSERT INTO public."RefreshToken" (id, token, "userId", "expiresAt", "createdAt") VALUES (6, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwiaWF0IjoxNzU4NjQ0Mjk1LCJleHAiOjE3NTkyNDkwOTV9.NbMH5b17sQE14423xzZHvDBrW40-FiZmfhhaB9cgNc0', 4, '2025-09-30 16:18:15.239', '2025-09-23 16:18:15.24');
INSERT INTO public."RefreshToken" (id, token, "userId", "expiresAt", "createdAt") VALUES (7, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NSwiaWF0IjoxNzU4NjQ1MDk2LCJleHAiOjE3NTkyNDk4OTZ9.9H17ZaY_WIui5-6jcM0v5YiIR48HaN-MjEy6GgsgpcI', 5, '2025-09-30 16:31:36.765', '2025-09-23 16:31:36.766');
INSERT INTO public."RefreshToken" (id, token, "userId", "expiresAt", "createdAt") VALUES (8, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiaWF0IjoxNzU4NjQ2ODk1LCJleHAiOjE3NTkyNTE2OTV9.cRjGh4f7Db-kiyjzArVwn6tvD1E0Foc22J19n1n3Fsk', 2, '2025-09-30 17:01:35.761', '2025-09-23 17:01:35.762');
INSERT INTO public."RefreshToken" (id, token, "userId", "expiresAt", "createdAt") VALUES (9, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiaWF0IjoxNzU4Njc2ODU4LCJleHAiOjE3NTkyODE2NTh9.IC1ChWuVyaVi6EtLVNPQhOmyumq4AQCE_dkMM1oLM-Y', 2, '2025-10-01 01:20:58.453', '2025-09-24 01:20:58.454');
INSERT INTO public."RefreshToken" (id, token, "userId", "expiresAt", "createdAt") VALUES (10, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiaWF0IjoxNzU4Njc3NDExLCJleHAiOjE3NTkyODIyMTF9.7YMPH5ujDNNjDJc3iGWR4NmVNeL6ysA5VvrvQ1tHSo4', 2, '2025-10-01 01:30:11.522', '2025-09-24 01:30:11.523');
INSERT INTO public."RefreshToken" (id, token, "userId", "expiresAt", "createdAt") VALUES (11, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiaWF0IjoxNzU4Njg2MzkxLCJleHAiOjE3NTkyOTExOTF9.UQ9PolmUAwQ0ExZRVUHG9zGJr9Q3mX1sNpcdvFexh-8', 2, '2025-10-01 03:59:51.087', '2025-09-24 03:59:51.088');
INSERT INTO public."RefreshToken" (id, token, "userId", "expiresAt", "createdAt") VALUES (12, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiaWF0IjoxNzU4NzEwMTExLCJleHAiOjE3NTkzMTQ5MTF9.mgBVXVpu5BeM4m5Rhd_6ez6LdpN0u5SJgJ4p2E1OrFQ', 2, '2025-10-01 10:35:11.569', '2025-09-24 10:35:11.571');
INSERT INTO public."RefreshToken" (id, token, "userId", "expiresAt", "createdAt") VALUES (13, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiaWF0IjoxNzU4NzE5NjU2LCJleHAiOjE3NTkzMjQ0NTZ9.UQwIgiNOvcVmpxcwKK_CSxAQbf6-42H-GdOg7WujBpI', 2, '2025-10-01 13:14:16.086', '2025-09-24 13:14:16.087');
INSERT INTO public."RefreshToken" (id, token, "userId", "expiresAt", "createdAt") VALUES (14, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiaWF0IjoxNzU4NzQ1OTcyLCJleHAiOjE3NTkzNTA3NzJ9.r2Q8ORU0vjrFLtDvgNUTRzYLIGUoohG4Ns8NBjg4z6g', 2, '2025-10-01 20:32:52.123', '2025-09-24 20:32:52.124');
INSERT INTO public."RefreshToken" (id, token, "userId", "expiresAt", "createdAt") VALUES (15, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiaWF0IjoxNzU4OTIwODEwLCJleHAiOjE3NTk1MjU2MTB9.3fUegtIlWNAahcbVwaayYbr5LE6o185cPgu6e6XJKTM', 2, '2025-10-03 21:06:50.433', '2025-09-26 21:06:50.434');
INSERT INTO public."RefreshToken" (id, token, "userId", "expiresAt", "createdAt") VALUES (16, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiaWF0IjoxNzU4OTI2MjQ4LCJleHAiOjE3NTk1MzEwNDh9.v1_47z4dZ4Ddd2Ztgu0exlcFOLgMtjmF0MWCNxWA5wI', 2, '2025-10-03 22:37:28.764', '2025-09-26 22:37:28.765');
INSERT INTO public."RefreshToken" (id, token, "userId", "expiresAt", "createdAt") VALUES (17, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiaWF0IjoxNzU4OTM1MjM5LCJleHAiOjE3NTk1NDAwMzl9.6ESJH55webAS3I_JaVwf_zax7lmyaS3cwmX2i5anfv4', 2, '2025-10-04 01:07:19.6', '2025-09-27 01:07:19.601');


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: country; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.country (country_id, code, name) VALUES (1, 'AR', 'Argentina');
INSERT INTO public.country (country_id, code, name) VALUES (2, 'PY', 'Paraguay');


--
-- Data for Name: province; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.province (province_id, country_id, code, name) VALUES (1, 1, 'CH', 'Chaco');
INSERT INTO public.province (province_id, country_id, code, name) VALUES (2, 1, 'CO', 'Corrientes');
INSERT INTO public.province (province_id, country_id, code, name) VALUES (3, 1, 'FO', 'Formosa');
INSERT INTO public.province (province_id, country_id, code, name) VALUES (4, 1, 'MI', 'Misiones');
INSERT INTO public.province (province_id, country_id, code, name) VALUES (5, 1, 'SF', 'Santa Fe');
INSERT INTO public.province (province_id, country_id, code, name) VALUES (6, 2, 'DC', 'Distrito Capital');


--
-- Data for Name: locality; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.locality (locality_id, province_id, code, name, is_active) VALUES (1, 1, 'RES', 'Resistencia', true);
INSERT INTO public.locality (locality_id, province_id, code, name, is_active) VALUES (2, 1, 'PRS', 'Presidencia Roque Sáenz Peña', true);
INSERT INTO public.locality (locality_id, province_id, code, name, is_active) VALUES (3, 1, 'JJC', 'Juan José Castelli', true);
INSERT INTO public.locality (locality_id, province_id, code, name, is_active) VALUES (4, 1, 'VANG', 'Villa Ángela', true);
INSERT INTO public.locality (locality_id, province_id, code, name, is_active) VALUES (5, 1, 'CHAR', 'Charata', true);
INSERT INTO public.locality (locality_id, province_id, code, name, is_active) VALUES (6, 2, 'CORR', 'Corrientes', true);
INSERT INTO public.locality (locality_id, province_id, code, name, is_active) VALUES (7, 2, 'GOYA', 'Goya', true);
INSERT INTO public.locality (locality_id, province_id, code, name, is_active) VALUES (8, 2, 'PASO', 'Paso de los Libres', true);
INSERT INTO public.locality (locality_id, province_id, code, name, is_active) VALUES (9, 2, 'CURU', 'Curuzú Cuatiá', true);
INSERT INTO public.locality (locality_id, province_id, code, name, is_active) VALUES (10, 2, 'MERC', 'Mercedes', true);
INSERT INTO public.locality (locality_id, province_id, code, name, is_active) VALUES (11, 3, 'FORM', 'Formosa', true);
INSERT INTO public.locality (locality_id, province_id, code, name, is_active) VALUES (12, 3, 'CLOR', 'Clorinda', true);
INSERT INTO public.locality (locality_id, province_id, code, name, is_active) VALUES (13, 3, 'PIRA', 'Pirané', true);
INSERT INTO public.locality (locality_id, province_id, code, name, is_active) VALUES (14, 4, 'POSA', 'Posadas', true);
INSERT INTO public.locality (locality_id, province_id, code, name, is_active) VALUES (15, 4, 'OBER', 'Oberá', true);
INSERT INTO public.locality (locality_id, province_id, code, name, is_active) VALUES (16, 4, 'ELDO', 'Eldorado', true);
INSERT INTO public.locality (locality_id, province_id, code, name, is_active) VALUES (17, 4, 'GARU', 'Garupá', true);
INSERT INTO public.locality (locality_id, province_id, code, name, is_active) VALUES (18, 4, 'IGUA', 'Puerto Iguazú', true);
INSERT INTO public.locality (locality_id, province_id, code, name, is_active) VALUES (19, 5, 'SFVC', 'Santa Fe de la Vera Cruz', true);
INSERT INTO public.locality (locality_id, province_id, code, name, is_active) VALUES (20, 5, 'ROSA', 'Rosario', true);
INSERT INTO public.locality (locality_id, province_id, code, name, is_active) VALUES (21, 5, 'RAFA', 'Rafaela', true);
INSERT INTO public.locality (locality_id, province_id, code, name, is_active) VALUES (22, 5, 'RECO', 'Reconquista', true);
INSERT INTO public.locality (locality_id, province_id, code, name, is_active) VALUES (23, 5, 'VICO', 'Villa Constitución', true);
INSERT INTO public.locality (locality_id, province_id, code, name, is_active) VALUES (24, 6, 'ASUN', 'Asunción', true);
INSERT INTO public.locality (locality_id, province_id, code, name, is_active) VALUES (25, 6, 'SLOR', 'San Lorenzo', true);
INSERT INTO public.locality (locality_id, province_id, code, name, is_active) VALUES (26, 6, 'FDM', 'Fernando de la Mora', true);
INSERT INTO public.locality (locality_id, province_id, code, name, is_active) VALUES (27, 6, 'LAMB', 'Lambaré', true);
INSERT INTO public.locality (locality_id, province_id, code, name, is_active) VALUES (28, 6, 'LUQU', 'Luque', true);
INSERT INTO public.locality (locality_id, province_id, code, name, is_active) VALUES (29, 6, 'MRA', 'Mariano Roque Alonso', true);
INSERT INTO public.locality (locality_id, province_id, code, name, is_active) VALUES (30, 1, 'FONTANA', 'Fontana', true);
INSERT INTO public.locality (locality_id, province_id, code, name, is_active) VALUES (31, 1, 'BARQUERAS', 'Barranqueras', true);


--
-- Data for Name: zone; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.zone (zone_id, code, name, locality_id, is_active) VALUES (1, 'CENTRO', 'Centro', 1, true);
INSERT INTO public.zone (zone_id, code, name, locality_id, is_active) VALUES (2, 'res-1', 'Zona 1', 1, true);
INSERT INTO public.zone (zone_id, code, name, locality_id, is_active) VALUES (3, 'res-2', 'Zona 2', 1, true);
INSERT INTO public.zone (zone_id, code, name, locality_id, is_active) VALUES (4, 'res-3', 'Zona 3', 1, true);
INSERT INTO public.zone (zone_id, code, name, locality_id, is_active) VALUES (5, 'res-4', 'Zona 4', 31, true);


--
-- Data for Name: person; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.person (person_id, phone, additional_phones, secondary_phone, name, tax_id, address, locality_id, zone_id, registration_date, type, alias, notes, is_active, owns_returnable_containers) VALUES (1, '3624565645', '3624874598 3624984567', NULL, 'Diego Alvarez', '20-37456234-4', 'vedia 1415', 1, 2, '2025-09-23', 'PLAN', 'el dorado', '', true, false);
INSERT INTO public.person (person_id, phone, additional_phones, secondary_phone, name, tax_id, address, locality_id, zone_id, registration_date, type, alias, notes, is_active, owns_returnable_containers) VALUES (3, '3624675694', '', NULL, 'Martin Garcia', '20-37098567-4', 'av 25 de mayo 456', 31, 5, '2025-09-23', 'PLAN', 'komsa', '', true, false);
INSERT INTO public.person (person_id, phone, additional_phones, secondary_phone, name, tax_id, address, locality_id, zone_id, registration_date, type, alias, notes, is_active, owns_returnable_containers) VALUES (2, '3624456432', '3624092367', NULL, 'Matias Garcia', '20-37456345-4', 'av sarmiento 300', 1, 3, '2025-09-23', 'PLAN', 'Llano Studio', '', true, false);
INSERT INTO public.person (person_id, phone, additional_phones, secondary_phone, name, tax_id, address, locality_id, zone_id, registration_date, type, alias, notes, is_active, owns_returnable_containers) VALUES (4, '3624596879', '', NULL, 'Renzo Zeniquel', '', 'necochea 1530', 1, 2, '2025-09-23', 'INDIVIDUAL', 'Travel Rock', '', true, false);
INSERT INTO public.person (person_id, phone, additional_phones, secondary_phone, name, tax_id, address, locality_id, zone_id, registration_date, type, alias, notes, is_active, owns_returnable_containers) VALUES (6, '3624685698', '', NULL, 'jose alvarez', '', 'santa fe 302', 1, 3, '2025-09-24', 'PLAN', '', '', true, false);
INSERT INTO public.person (person_id, phone, additional_phones, secondary_phone, name, tax_id, address, locality_id, zone_id, registration_date, type, alias, notes, is_active, owns_returnable_containers) VALUES (5, '3624527635', '', NULL, 'Facundo Zeniquel', '', 'goitia 1214', 1, 3, '2025-09-24', 'PLAN', '', '', true, false);


--
-- Data for Name: subscription_plan; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.subscription_plan (subscription_plan_id, name, description, price, type, created_at, default_cycle_days, default_deliveries_per_cycle, is_active, updated_at) VALUES (1, 'Abono 6x 20LTS', 'Abono 6 bidones de 20LTS', 10000.00, 'PLAN', '2025-09-24 10:26:53.696', 30, 2, true, '2025-09-24 10:26:53.696');
INSERT INTO public.subscription_plan (subscription_plan_id, name, description, price, type, created_at, default_cycle_days, default_deliveries_per_cycle, is_active, updated_at) VALUES (2, 'Abono 6x12LTS', 'Abono 6 bidones de 12LTS', 7000.00, 'PLAN', '2025-09-24 10:27:26.128', 30, 2, true, '2025-09-24 10:27:26.128');


--
-- Data for Name: customer_subscription; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.customer_subscription (subscription_id, customer_id, subscription_plan_id, start_date, collection_day, payment_mode, payment_due_day, status, notes, cancellation_reason, cancellation_date, collection_scheduled_date, collection_completed, is_active) VALUES (12, 2, 1, '2025-09-26', 26, 'ADVANCE', NULL, 'ACTIVE', '{"delivery_preferences":{"special_instructions":"timbre 204","preferred_days":["MONDAY","WEDNESDAY","FRIDAY"],"preferred_time_range":"08:00-12:00","avoid_times":["15:00-18:00"]}}', NULL, NULL, NULL, false, true);
INSERT INTO public.customer_subscription (subscription_id, customer_id, subscription_plan_id, start_date, collection_day, payment_mode, payment_due_day, status, notes, cancellation_reason, cancellation_date, collection_scheduled_date, collection_completed, is_active) VALUES (13, 2, 2, '2025-09-26', 26, 'ARREARS', NULL, 'ACTIVE', '{"delivery_preferences":{"special_instructions":"timbre 203","preferred_days":["MONDAY","THURSDAY"],"preferred_time_range":"08:00-12:00","avoid_times":["15:00-18:00"]}}', NULL, NULL, NULL, false, true);
INSERT INTO public.customer_subscription (subscription_id, customer_id, subscription_plan_id, start_date, collection_day, payment_mode, payment_due_day, status, notes, cancellation_reason, cancellation_date, collection_scheduled_date, collection_completed, is_active) VALUES (14, 4, 1, '2025-09-26', 26, 'ADVANCE', NULL, 'ACTIVE', '{"delivery_preferences":{"special_instructions":"timbre 305","preferred_days":["MONDAY","WEDNESDAY","FRIDAY"],"preferred_time_range":"08:00-12:00","avoid_times":["15:00-18:00"]}}', NULL, NULL, NULL, false, true);
INSERT INTO public.customer_subscription (subscription_id, customer_id, subscription_plan_id, start_date, collection_day, payment_mode, payment_due_day, status, notes, cancellation_reason, cancellation_date, collection_scheduled_date, collection_completed, is_active) VALUES (15, 2, 1, '2025-09-26', 10, 'ARREARS', NULL, 'ACTIVE', '{"delivery_preferences":{"special_instructions":"timbre 204 local 4","preferred_days":["MONDAY","THURSDAY"],"preferred_time_range":"08:00-12:00","avoid_times":["15:00-18:00"]}}', NULL, NULL, NULL, false, true);
INSERT INTO public.customer_subscription (subscription_id, customer_id, subscription_plan_id, start_date, collection_day, payment_mode, payment_due_day, status, notes, cancellation_reason, cancellation_date, collection_scheduled_date, collection_completed, is_active) VALUES (16, 2, 2, '2025-09-26', 22, 'ARREARS', NULL, 'ACTIVE', '{"delivery_preferences":{"special_instructions":"timbre 506 local 7","preferred_days":["MONDAY","FRIDAY"],"preferred_time_range":"08:00-12:00","avoid_times":["15:00-18:00"]}}', NULL, NULL, NULL, false, true);
INSERT INTO public.customer_subscription (subscription_id, customer_id, subscription_plan_id, start_date, collection_day, payment_mode, payment_due_day, status, notes, cancellation_reason, cancellation_date, collection_scheduled_date, collection_completed, is_active) VALUES (17, 4, 2, '2025-09-27', 26, 'ADVANCE', NULL, 'ACTIVE', '{"delivery_preferences":{"special_instructions":"","preferred_days":["MONDAY","FRIDAY"],"preferred_time_range":"08:00-12:00","avoid_times":["15:00-18:00"]}}', NULL, NULL, NULL, false, true);


--
-- Data for Name: vehicle; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.vehicle (vehicle_id, code, name, description, is_active) VALUES (1, 'abs-345', 'Movil 1', 'Camion Mercedes Benz', true);
INSERT INTO public.vehicle (vehicle_id, code, name, description, is_active) VALUES (2, 'sdf-543', 'Movil 2', 'Camion Fiat', true);
INSERT INTO public.vehicle (vehicle_id, code, name, description, is_active) VALUES (3, 'kjh-234', 'Movil 3', 'Camion Volvo', true);


--
-- Data for Name: route_sheet; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: cancellation_order; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: price_list; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.price_list (price_list_id, name, effective_date, active, created_at, description, is_default, updated_at, is_active) VALUES (1, 'Lista General/Estándar', '2024-01-01', true, '2025-09-26 21:03:33.069', 'Lista de precios estándar del sistema', true, '2025-09-26 21:03:33.069', true);
INSERT INTO public.price_list (price_list_id, name, effective_date, active, created_at, description, is_default, updated_at, is_active) VALUES (2, 'Lista Mayorista', '2025-09-23', true, '2025-09-24 01:23:08.308', 'Lista de precios Mayorista', false, '2025-09-24 01:23:08.308', true);


--
-- Data for Name: client_contract; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: product_category; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.product_category (category_id, name) VALUES (1, 'Bidones');
INSERT INTO public.product_category (category_id, name) VALUES (2, 'Dispensers');


--
-- Data for Name: product; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.product (product_id, category_id, description, volume_liters, price, is_returnable, serial_number, notes, image_url, is_active) VALUES (1, 1, 'Bidon 20 LTS', 20.00, 2000.00, true, '123123', 'Bidon 20 LTS retornable', 'bidon-poli-20-pag-1402.jpg', true);
INSERT INTO public.product (product_id, category_id, description, volume_liters, price, is_returnable, serial_number, notes, image_url, is_active) VALUES (2, 1, 'Bidon 12 LTS', 12.00, 1500.00, true, '123345', 'Bidon 12 LTS retornable', 'producto_bidon_foto-5-6b3a.jpg', true);
INSERT INTO public.product (product_id, category_id, description, volume_liters, price, is_returnable, serial_number, notes, image_url, is_active) VALUES (5, 2, 'Dispenser Agua Frio Calor', 0.00, 200000.00, true, '123345', 'Dispenser Agua Frio Calor para comodato', '93d9bb0d054b43b6e4c9b3ad24607b7470a32aaab4bc25f3e27f305be24ed9b963845-366e.jpg', true);
INSERT INTO public.product (product_id, category_id, description, volume_liters, price, is_returnable, serial_number, notes, image_url, is_active) VALUES (7, 1, 'botellon 30 Lts', 30.00, 3000.00, true, '1234', 'Botellon de Agua mineral retornable', 'bidon-poli-20-pag-db48.jpg', true);
INSERT INTO public.product (product_id, category_id, description, volume_liters, price, is_returnable, serial_number, notes, image_url, is_active) VALUES (4, 1, 'Bidon 3 LTS', 3.00, 500.00, false, '123', 'Bidon 3 LTS descartable', NULL, true);
INSERT INTO public.product (product_id, category_id, description, volume_liters, price, is_returnable, serial_number, notes, image_url, is_active) VALUES (3, 1, 'Bidon 7 LTS', 7.00, 1200.00, false, '456678', 'Bidon 7 LTS descartable', 'Captura desde 2025-09-23 13-59-07-b8f7.png', true);
INSERT INTO public.product (product_id, category_id, description, volume_liters, price, is_returnable, serial_number, notes, image_url, is_active) VALUES (6, 1, 'Botella 1000cc', 1.00, 1000.00, false, '123', 'Botella 500cc descartable', 'MG_0161imlogo_111-5782.png', true);
INSERT INTO public.product (product_id, category_id, description, volume_liters, price, is_returnable, serial_number, notes, image_url, is_active) VALUES (8, 1, 'Bidon test', 1.00, 100.00, false, '123', 'Bidon test', NULL, true);


--
-- Data for Name: comodato; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.comodato (comodato_id, person_id, product_id, subscription_id, quantity, delivery_date, return_date, expected_return_date, status, notes, deposit_amount, monthly_fee, article_description, brand, model, contract_image_path, created_at, updated_at, is_active) VALUES (18, 2, 1, 12, 6, '2025-09-26', NULL, '2026-09-26', 'ACTIVE', 'Comodato automático - Primer ciclo de suscripción 12 - Suscripción ID: 12', NULL, NULL, 'Bidon 20 LTS', NULL, NULL, NULL, '2025-09-26 22:00:43.012', '2025-09-26 22:00:43.012', true);
INSERT INTO public.comodato (comodato_id, person_id, product_id, subscription_id, quantity, delivery_date, return_date, expected_return_date, status, notes, deposit_amount, monthly_fee, article_description, brand, model, contract_image_path, created_at, updated_at, is_active) VALUES (19, 2, 5, 12, 1, '2025-09-26', NULL, '2026-09-26', 'ACTIVE', 'Comodato automático - Primer ciclo de suscripción 12 - Suscripción ID: 12', NULL, NULL, 'Dispenser Agua Frio Calor', NULL, NULL, NULL, '2025-09-26 22:00:43.034', '2025-09-26 22:00:43.034', true);
INSERT INTO public.comodato (comodato_id, person_id, product_id, subscription_id, quantity, delivery_date, return_date, expected_return_date, status, notes, deposit_amount, monthly_fee, article_description, brand, model, contract_image_path, created_at, updated_at, is_active) VALUES (20, 2, 2, 13, 6, '2025-09-26', NULL, '2026-09-26', 'ACTIVE', 'Comodato automático - Primer ciclo de suscripción 13 - Suscripción ID: 13', NULL, NULL, 'Bidon 12 LTS', NULL, NULL, NULL, '2025-09-26 22:03:00.683', '2025-09-26 22:03:00.683', true);
INSERT INTO public.comodato (comodato_id, person_id, product_id, subscription_id, quantity, delivery_date, return_date, expected_return_date, status, notes, deposit_amount, monthly_fee, article_description, brand, model, contract_image_path, created_at, updated_at, is_active) VALUES (21, 2, 5, 13, 1, '2025-09-26', NULL, '2026-09-26', 'ACTIVE', 'Comodato automático - Primer ciclo de suscripción 13 - Suscripción ID: 13', NULL, NULL, 'Dispenser Agua Frio Calor', NULL, NULL, NULL, '2025-09-26 22:03:00.692', '2025-09-26 22:03:00.692', true);
INSERT INTO public.comodato (comodato_id, person_id, product_id, subscription_id, quantity, delivery_date, return_date, expected_return_date, status, notes, deposit_amount, monthly_fee, article_description, brand, model, contract_image_path, created_at, updated_at, is_active) VALUES (22, 4, 1, 14, 6, '2025-09-26', NULL, '2026-09-26', 'ACTIVE', 'Comodato automático - Primer ciclo de suscripción 14 - Suscripción ID: 14', NULL, NULL, 'Bidon 20 LTS', NULL, NULL, NULL, '2025-09-26 22:36:36.003', '2025-09-26 22:36:36.003', true);
INSERT INTO public.comodato (comodato_id, person_id, product_id, subscription_id, quantity, delivery_date, return_date, expected_return_date, status, notes, deposit_amount, monthly_fee, article_description, brand, model, contract_image_path, created_at, updated_at, is_active) VALUES (23, 4, 5, 14, 1, '2025-09-26', NULL, '2026-09-26', 'ACTIVE', 'Comodato automático - Primer ciclo de suscripción 14 - Suscripción ID: 14', NULL, NULL, 'Dispenser Agua Frio Calor', NULL, NULL, NULL, '2025-09-26 22:36:36.019', '2025-09-26 22:36:36.019', true);
INSERT INTO public.comodato (comodato_id, person_id, product_id, subscription_id, quantity, delivery_date, return_date, expected_return_date, status, notes, deposit_amount, monthly_fee, article_description, brand, model, contract_image_path, created_at, updated_at, is_active) VALUES (24, 2, 1, 15, 6, '2025-09-26', NULL, '2026-09-26', 'ACTIVE', 'Comodato automático - Primer ciclo de suscripción 15 - Suscripción ID: 15', NULL, NULL, 'Bidon 20 LTS', NULL, NULL, NULL, '2025-09-26 22:44:32.899', '2025-09-26 22:44:32.899', true);
INSERT INTO public.comodato (comodato_id, person_id, product_id, subscription_id, quantity, delivery_date, return_date, expected_return_date, status, notes, deposit_amount, monthly_fee, article_description, brand, model, contract_image_path, created_at, updated_at, is_active) VALUES (25, 2, 5, 15, 1, '2025-09-26', NULL, '2026-09-26', 'ACTIVE', 'Comodato automático - Primer ciclo de suscripción 15 - Suscripción ID: 15', NULL, NULL, 'Dispenser Agua Frio Calor', NULL, NULL, NULL, '2025-09-26 22:44:32.91', '2025-09-26 22:44:32.91', true);
INSERT INTO public.comodato (comodato_id, person_id, product_id, subscription_id, quantity, delivery_date, return_date, expected_return_date, status, notes, deposit_amount, monthly_fee, article_description, brand, model, contract_image_path, created_at, updated_at, is_active) VALUES (26, 2, 2, 16, 6, '2025-09-26', NULL, '2026-09-26', 'ACTIVE', 'Comodato automático - Primer ciclo de suscripción 16 - Suscripción ID: 16', NULL, NULL, 'Bidon 12 LTS', NULL, NULL, NULL, '2025-09-26 22:46:23.423', '2025-09-26 22:46:23.423', true);
INSERT INTO public.comodato (comodato_id, person_id, product_id, subscription_id, quantity, delivery_date, return_date, expected_return_date, status, notes, deposit_amount, monthly_fee, article_description, brand, model, contract_image_path, created_at, updated_at, is_active) VALUES (27, 2, 5, 16, 1, '2025-09-26', NULL, '2026-09-26', 'ACTIVE', 'Comodato automático - Primer ciclo de suscripción 16 - Suscripción ID: 16', NULL, NULL, 'Dispenser Agua Frio Calor', NULL, NULL, NULL, '2025-09-26 22:46:23.436', '2025-09-26 22:46:23.436', true);
INSERT INTO public.comodato (comodato_id, person_id, product_id, subscription_id, quantity, delivery_date, return_date, expected_return_date, status, notes, deposit_amount, monthly_fee, article_description, brand, model, contract_image_path, created_at, updated_at, is_active) VALUES (28, 4, 2, 17, 6, '2025-09-27', NULL, '2026-09-27', 'ACTIVE', 'Comodato automático - Primer ciclo de suscripción 17 - Suscripción ID: 17', NULL, NULL, 'Bidon 12 LTS', NULL, NULL, NULL, '2025-09-27 02:40:10.193', '2025-09-27 02:40:10.193', true);
INSERT INTO public.comodato (comodato_id, person_id, product_id, subscription_id, quantity, delivery_date, return_date, expected_return_date, status, notes, deposit_amount, monthly_fee, article_description, brand, model, contract_image_path, created_at, updated_at, is_active) VALUES (29, 4, 5, 17, 1, '2025-09-27', NULL, '2026-09-27', 'ACTIVE', 'Comodato automático - Primer ciclo de suscripción 17 - Suscripción ID: 17', NULL, NULL, 'Dispenser Agua Frio Calor', NULL, NULL, NULL, '2025-09-27 02:40:10.213', '2025-09-27 02:40:10.213', true);


--
-- Data for Name: comodato_change; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: contract_delivery_schedule; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: subscription_cycle; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.subscription_cycle (cycle_id, subscription_id, cycle_number, cycle_start, cycle_end, payment_due_date, is_overdue, late_fee_applied, late_fee_percentage, notes, total_amount, paid_amount, pending_balance, credit_balance, payment_status) VALUES (15, 15, 1, '2025-09-26', '2025-10-10', '2025-10-20', false, false, NULL, NULL, 10000.00, 0.00, 10000.00, 0.00, 'PENDING');
INSERT INTO public.subscription_cycle (cycle_id, subscription_id, cycle_number, cycle_start, cycle_end, payment_due_date, is_overdue, late_fee_applied, late_fee_percentage, notes, total_amount, paid_amount, pending_balance, credit_balance, payment_status) VALUES (16, 16, 1, '2025-09-26', '2025-10-22', '2025-11-01', false, false, NULL, NULL, 7000.00, 0.00, 7000.00, 0.00, 'PENDING');
INSERT INTO public.subscription_cycle (cycle_id, subscription_id, cycle_number, cycle_start, cycle_end, payment_due_date, is_overdue, late_fee_applied, late_fee_percentage, notes, total_amount, paid_amount, pending_balance, credit_balance, payment_status) VALUES (12, 12, 1, '2025-09-26', '2025-10-26', '2025-09-26', false, false, NULL, NULL, 10000.00, 10000.00, 0.00, 0.00, 'PAID');
INSERT INTO public.subscription_cycle (cycle_id, subscription_id, cycle_number, cycle_start, cycle_end, payment_due_date, is_overdue, late_fee_applied, late_fee_percentage, notes, total_amount, paid_amount, pending_balance, credit_balance, payment_status) VALUES (14, 14, 1, '2025-09-26', '2025-10-26', '2025-09-26', false, false, NULL, NULL, 10000.00, 10000.00, 0.00, 0.00, 'PAID');
INSERT INTO public.subscription_cycle (cycle_id, subscription_id, cycle_number, cycle_start, cycle_end, payment_due_date, is_overdue, late_fee_applied, late_fee_percentage, notes, total_amount, paid_amount, pending_balance, credit_balance, payment_status) VALUES (13, 13, 1, '2025-09-26', '2025-10-26', '2025-11-05', false, false, NULL, NULL, 7000.00, 7000.00, 0.00, 0.00, 'PAID');
INSERT INTO public.subscription_cycle (cycle_id, subscription_id, cycle_number, cycle_start, cycle_end, payment_due_date, is_overdue, late_fee_applied, late_fee_percentage, notes, total_amount, paid_amount, pending_balance, credit_balance, payment_status) VALUES (17, 17, 1, '2025-09-27', '2025-10-26', '2025-09-27', false, false, NULL, NULL, 7000.00, 7000.00, 0.00, 2000.00, 'CREDITED');


--
-- Data for Name: cycle_payment; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.cycle_payment (payment_id, cycle_id, payment_date, amount, payment_method, reference, notes, created_by) VALUES (5, 12, '2025-09-26 10:30:00', 4000.00, 'EFECTIVO', 'TRANS-001234', 'Pago correspondiente al ciclo de septiembre 2025', NULL);
INSERT INTO public.cycle_payment (payment_id, cycle_id, payment_date, amount, payment_method, reference, notes, created_by) VALUES (6, 12, '2025-09-26 10:30:00', 6000.00, 'EFECTIVO', 'TRANS-001234', 'Pago correspondiente al ciclo de septiembre 2025', NULL);
INSERT INTO public.cycle_payment (payment_id, cycle_id, payment_date, amount, payment_method, reference, notes, created_by) VALUES (7, 14, '2025-09-27 01:56:00', 4000.00, 'EFECTIVO', 'sdfsdfs-34563', 'pago parcial', NULL);
INSERT INTO public.cycle_payment (payment_id, cycle_id, payment_date, amount, payment_method, reference, notes, created_by) VALUES (8, 14, '2025-09-27 01:56:00', 6000.00, 'TRANSFERENCIA', 'asdasdasd-6456', 'pago parcial para completar', NULL);
INSERT INTO public.cycle_payment (payment_id, cycle_id, payment_date, amount, payment_method, reference, notes, created_by) VALUES (9, 13, '2025-09-27 02:16:00', 2000.00, 'EFECTIVO', 'dfgdfg-43564', 'pago parcial', NULL);
INSERT INTO public.cycle_payment (payment_id, cycle_id, payment_date, amount, payment_method, reference, notes, created_by) VALUES (10, 13, '2025-09-27 02:16:00', 5000.00, 'EFECTIVO', NULL, NULL, NULL);
INSERT INTO public.cycle_payment (payment_id, cycle_id, payment_date, amount, payment_method, reference, notes, created_by) VALUES (11, 17, '2025-09-27 02:49:00', 2000.00, 'EFECTIVO', 'asdas-3245', 'pago parcial', NULL);
INSERT INTO public.cycle_payment (payment_id, cycle_id, payment_date, amount, payment_method, reference, notes, created_by) VALUES (12, 17, '2025-09-27 03:00:00', 7000.00, 'EFECTIVO', 'cvbcvbvcñ-34543', 'pago parcial', NULL);


--
-- Data for Name: sale_channel; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.sale_channel (sale_channel_id, code, description) VALUES (1, 'WEB', 'Ventas a través de la página web');
INSERT INTO public.sale_channel (sale_channel_id, code, description) VALUES (2, 'WHATSAPP', 'Ventas a través de WhatsApp');


--
-- Data for Name: one_off_purchase; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: one_off_purchase_header; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.one_off_purchase_header (purchase_header_id, person_id, sale_channel_id, purchase_date, total_amount, paid_amount, delivery_address, locality_id, zone_id, price_list_id, notes, status, payment_status, delivery_status, created_at, updated_at, scheduled_delivery_date, delivery_time, is_active) VALUES (1, 5, 1, '2025-09-24 00:00:00', 10000.00, 10000.00, 'goitia 1214', 1, 3, NULL, 'avisar antes', 'PENDING', 'PENDING', 'PENDING', '2025-09-24 01:27:34.648', '2025-09-24 01:27:34.648', '2025-09-24 00:00:00', '08:00-12:00', true);


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

INSERT INTO public.warehouse (warehouse_id, name, locality_id) VALUES (1, 'Almacén Principal', 1);


--
-- Data for Name: inventory; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.inventory (warehouse_id, product_id, quantity) VALUES (1, 1, 100);
INSERT INTO public.inventory (warehouse_id, product_id, quantity) VALUES (1, 2, 100);
INSERT INTO public.inventory (warehouse_id, product_id, quantity) VALUES (1, 3, 100);
INSERT INTO public.inventory (warehouse_id, product_id, quantity) VALUES (1, 4, 100);
INSERT INTO public.inventory (warehouse_id, product_id, quantity) VALUES (1, 5, 100);
INSERT INTO public.inventory (warehouse_id, product_id, quantity) VALUES (1, 6, 100);
INSERT INTO public.inventory (warehouse_id, product_id, quantity) VALUES (1, 7, 100);
INSERT INTO public.inventory (warehouse_id, product_id, quantity) VALUES (1, 8, 100);


--
-- Data for Name: inventory_transaction; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: movement_type; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.movement_type (movement_type_id, code, description) VALUES (1, 'EGR_VENTA', 'Egreso por venta de producto');
INSERT INTO public.movement_type (movement_type_id, code, description) VALUES (2, 'EGR_V_UNI', 'Egreso por venta única');
INSERT INTO public.movement_type (movement_type_id, code, description) VALUES (3, 'EGR_COMOD', 'Egreso por entrega en comodato');
INSERT INTO public.movement_type (movement_type_id, code, description) VALUES (4, 'AJ_NEG', 'Ajuste negativo de inventario');
INSERT INTO public.movement_type (movement_type_id, code, description) VALUES (5, 'TRANS_SAL', 'Transferencia de salida');
INSERT INTO public.movement_type (movement_type_id, code, description) VALUES (6, 'ING_DEV_PC', 'Ingreso por devolución de pedido cancelado');
INSERT INTO public.movement_type (movement_type_id, code, description) VALUES (7, 'ING_DEV_CL', 'Ingreso por devolución de cliente');
INSERT INTO public.movement_type (movement_type_id, code, description) VALUES (8, 'ING_DV_VU', 'Ingreso por devolución de venta única');
INSERT INTO public.movement_type (movement_type_id, code, description) VALUES (9, 'ING_DV_VUC', 'Ingreso por devolución de venta única cancelada');
INSERT INTO public.movement_type (movement_type_id, code, description) VALUES (10, 'ING_PROD', 'Ingreso por producción');
INSERT INTO public.movement_type (movement_type_id, code, description) VALUES (11, 'ING_COMP', 'Ingreso por compra externa');
INSERT INTO public.movement_type (movement_type_id, code, description) VALUES (12, 'ING_DV_COM', 'Ingreso por devolución de comodato');
INSERT INTO public.movement_type (movement_type_id, code, description) VALUES (13, 'AJ_POS', 'Ajuste positivo de inventario');
INSERT INTO public.movement_type (movement_type_id, code, description) VALUES (14, 'TRANS_ENT', 'Transferencia de entrada');
INSERT INTO public.movement_type (movement_type_id, code, description) VALUES (15, 'ING_DEV_CS', 'Ingreso dev. cancelación');


--
-- Data for Name: one_off_purchase_item; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.one_off_purchase_item (purchase_item_id, purchase_header_id, product_id, quantity, unit_price, subtotal, notes, price_list_id) VALUES (1, 1, 2, 2, 1500.00, 3000.00, NULL, 1);
INSERT INTO public.one_off_purchase_item (purchase_item_id, purchase_header_id, product_id, quantity, unit_price, subtotal, notes, price_list_id) VALUES (2, 1, 3, 2, 1200.00, 2400.00, NULL, 1);
INSERT INTO public.one_off_purchase_item (purchase_item_id, purchase_header_id, product_id, quantity, unit_price, subtotal, notes, price_list_id) VALUES (3, 1, 3, 2, 1000.00, 2000.00, NULL, 2);
INSERT INTO public.one_off_purchase_item (purchase_item_id, purchase_header_id, product_id, quantity, unit_price, subtotal, notes, price_list_id) VALUES (4, 1, 2, 2, 1300.00, 2600.00, NULL, 2);


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

INSERT INTO public.price_list_item (price_list_item_id, price_list_id, product_id, unit_price) VALUES (2, 1, 2, 1500.00);
INSERT INTO public.price_list_item (price_list_item_id, price_list_id, product_id, unit_price) VALUES (5, 1, 5, 200000.00);
INSERT INTO public.price_list_item (price_list_item_id, price_list_id, product_id, unit_price) VALUES (6, 2, 2, 1300.00);
INSERT INTO public.price_list_item (price_list_item_id, price_list_id, product_id, unit_price) VALUES (7, 2, 1, 1700.00);
INSERT INTO public.price_list_item (price_list_item_id, price_list_id, product_id, unit_price) VALUES (8, 2, 4, 300.00);
INSERT INTO public.price_list_item (price_list_item_id, price_list_id, product_id, unit_price) VALUES (9, 2, 3, 1000.00);
INSERT INTO public.price_list_item (price_list_item_id, price_list_id, product_id, unit_price) VALUES (10, 2, 5, 150000.00);
INSERT INTO public.price_list_item (price_list_item_id, price_list_id, product_id, unit_price) VALUES (12, 1, 7, 3000.00);
INSERT INTO public.price_list_item (price_list_item_id, price_list_id, product_id, unit_price) VALUES (4, 1, 4, 500.00);
INSERT INTO public.price_list_item (price_list_item_id, price_list_id, product_id, unit_price) VALUES (3, 1, 3, 1200.00);
INSERT INTO public.price_list_item (price_list_item_id, price_list_id, product_id, unit_price) VALUES (11, 1, 6, 1000.00);


--
-- Data for Name: price_list_history; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: recovery_order; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: route_optimization; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: stock_movement; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.stock_movement (stock_movement_id, movement_date, movement_type_id, product_id, source_warehouse_id, destination_warehouse_id, quantity, remarks, order_id, reference_document, user_id) VALUES (1, '2025-09-23 16:56:41.311', 10, 1, NULL, 1, 100, 'Stock inicial - Bidon 20 LTS', NULL, NULL, NULL);
INSERT INTO public.stock_movement (stock_movement_id, movement_date, movement_type_id, product_id, source_warehouse_id, destination_warehouse_id, quantity, remarks, order_id, reference_document, user_id) VALUES (2, '2025-09-23 16:58:03.9', 10, 2, NULL, 1, 100, 'Stock inicial - Bidon 12 LTS', NULL, NULL, NULL);
INSERT INTO public.stock_movement (stock_movement_id, movement_date, movement_type_id, product_id, source_warehouse_id, destination_warehouse_id, quantity, remarks, order_id, reference_document, user_id) VALUES (3, '2025-09-23 16:59:46.245', 10, 3, NULL, 1, 100, 'Stock inicial - Bidon 7 LTS', NULL, NULL, NULL);
INSERT INTO public.stock_movement (stock_movement_id, movement_date, movement_type_id, product_id, source_warehouse_id, destination_warehouse_id, quantity, remarks, order_id, reference_document, user_id) VALUES (4, '2025-09-23 17:03:05.32', 10, 4, NULL, 1, 100, 'Stock inicial - Bidon 3 LTS', NULL, NULL, NULL);
INSERT INTO public.stock_movement (stock_movement_id, movement_date, movement_type_id, product_id, source_warehouse_id, destination_warehouse_id, quantity, remarks, order_id, reference_document, user_id) VALUES (5, '2025-09-23 17:07:47.506', 10, 5, NULL, 1, 100, 'Stock inicial - Dispenser Agua Frio Calor', NULL, NULL, NULL);
INSERT INTO public.stock_movement (stock_movement_id, movement_date, movement_type_id, product_id, source_warehouse_id, destination_warehouse_id, quantity, remarks, order_id, reference_document, user_id) VALUES (6, '2025-09-24 01:52:03.455', 10, 6, NULL, 1, 100, 'Stock inicial - Botella 1000cc', NULL, NULL, NULL);
INSERT INTO public.stock_movement (stock_movement_id, movement_date, movement_type_id, product_id, source_warehouse_id, destination_warehouse_id, quantity, remarks, order_id, reference_document, user_id) VALUES (7, '2025-09-24 13:11:42.976', 10, 7, NULL, 1, 100, 'Stock inicial - botellon 30 Lts', NULL, NULL, NULL);
INSERT INTO public.stock_movement (stock_movement_id, movement_date, movement_type_id, product_id, source_warehouse_id, destination_warehouse_id, quantity, remarks, order_id, reference_document, user_id) VALUES (8, '2025-09-24 20:34:38.411', 10, 8, NULL, 1, 100, 'Stock inicial - Bidon test', NULL, NULL, NULL);


--
-- Data for Name: subscription_cycle_detail; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.subscription_cycle_detail (cycle_detail_id, cycle_id, product_id, planned_quantity, delivered_quantity, remaining_balance) VALUES (23, 12, 1, 6, 0, 6);
INSERT INTO public.subscription_cycle_detail (cycle_detail_id, cycle_id, product_id, planned_quantity, delivered_quantity, remaining_balance) VALUES (24, 12, 5, 1, 0, 1);
INSERT INTO public.subscription_cycle_detail (cycle_detail_id, cycle_id, product_id, planned_quantity, delivered_quantity, remaining_balance) VALUES (25, 13, 2, 6, 0, 6);
INSERT INTO public.subscription_cycle_detail (cycle_detail_id, cycle_id, product_id, planned_quantity, delivered_quantity, remaining_balance) VALUES (26, 13, 5, 1, 0, 1);
INSERT INTO public.subscription_cycle_detail (cycle_detail_id, cycle_id, product_id, planned_quantity, delivered_quantity, remaining_balance) VALUES (27, 14, 1, 6, 0, 6);
INSERT INTO public.subscription_cycle_detail (cycle_detail_id, cycle_id, product_id, planned_quantity, delivered_quantity, remaining_balance) VALUES (28, 14, 5, 1, 0, 1);
INSERT INTO public.subscription_cycle_detail (cycle_detail_id, cycle_id, product_id, planned_quantity, delivered_quantity, remaining_balance) VALUES (29, 15, 1, 6, 0, 6);
INSERT INTO public.subscription_cycle_detail (cycle_detail_id, cycle_id, product_id, planned_quantity, delivered_quantity, remaining_balance) VALUES (30, 15, 5, 1, 0, 1);
INSERT INTO public.subscription_cycle_detail (cycle_detail_id, cycle_id, product_id, planned_quantity, delivered_quantity, remaining_balance) VALUES (31, 16, 2, 6, 0, 6);
INSERT INTO public.subscription_cycle_detail (cycle_detail_id, cycle_id, product_id, planned_quantity, delivered_quantity, remaining_balance) VALUES (32, 16, 5, 1, 0, 1);
INSERT INTO public.subscription_cycle_detail (cycle_detail_id, cycle_id, product_id, planned_quantity, delivered_quantity, remaining_balance) VALUES (33, 17, 2, 6, 0, 6);
INSERT INTO public.subscription_cycle_detail (cycle_detail_id, cycle_id, product_id, planned_quantity, delivered_quantity, remaining_balance) VALUES (34, 17, 5, 1, 0, 1);


--
-- Data for Name: subscription_delivery_schedule; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.subscription_delivery_schedule (schedule_id, subscription_id, day_of_week, scheduled_time) VALUES (27, 12, 1, '08:00-12:00');
INSERT INTO public.subscription_delivery_schedule (schedule_id, subscription_id, day_of_week, scheduled_time) VALUES (28, 12, 3, '08:00-12:00');
INSERT INTO public.subscription_delivery_schedule (schedule_id, subscription_id, day_of_week, scheduled_time) VALUES (29, 12, 5, '08:00-12:00');
INSERT INTO public.subscription_delivery_schedule (schedule_id, subscription_id, day_of_week, scheduled_time) VALUES (30, 13, 1, '08:00-12:00');
INSERT INTO public.subscription_delivery_schedule (schedule_id, subscription_id, day_of_week, scheduled_time) VALUES (31, 13, 4, '08:00-12:00');
INSERT INTO public.subscription_delivery_schedule (schedule_id, subscription_id, day_of_week, scheduled_time) VALUES (32, 14, 1, '08:00-12:00');
INSERT INTO public.subscription_delivery_schedule (schedule_id, subscription_id, day_of_week, scheduled_time) VALUES (33, 14, 3, '08:00-12:00');
INSERT INTO public.subscription_delivery_schedule (schedule_id, subscription_id, day_of_week, scheduled_time) VALUES (34, 14, 5, '08:00-12:00');
INSERT INTO public.subscription_delivery_schedule (schedule_id, subscription_id, day_of_week, scheduled_time) VALUES (35, 15, 1, '08:00-12:00');
INSERT INTO public.subscription_delivery_schedule (schedule_id, subscription_id, day_of_week, scheduled_time) VALUES (36, 15, 4, '08:00-12:00');
INSERT INTO public.subscription_delivery_schedule (schedule_id, subscription_id, day_of_week, scheduled_time) VALUES (37, 16, 1, '08:00-12:00');
INSERT INTO public.subscription_delivery_schedule (schedule_id, subscription_id, day_of_week, scheduled_time) VALUES (38, 16, 5, '08:00-12:00');
INSERT INTO public.subscription_delivery_schedule (schedule_id, subscription_id, day_of_week, scheduled_time) VALUES (39, 17, 1, '08:00-12:00');
INSERT INTO public.subscription_delivery_schedule (schedule_id, subscription_id, day_of_week, scheduled_time) VALUES (40, 17, 5, '08:00-12:00');


--
-- Data for Name: subscription_plan_product; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.subscription_plan_product (spp_id, subscription_plan_id, product_id, product_quantity) VALUES (1, 1, 1, 6);
INSERT INTO public.subscription_plan_product (spp_id, subscription_plan_id, product_id, product_quantity) VALUES (2, 1, 5, 1);
INSERT INTO public.subscription_plan_product (spp_id, subscription_plan_id, product_id, product_quantity) VALUES (3, 2, 2, 6);
INSERT INTO public.subscription_plan_product (spp_id, subscription_plan_id, product_id, product_quantity) VALUES (4, 2, 5, 1);


--
-- Data for Name: user_vehicle; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.user_vehicle (user_vehicle_id, user_id, vehicle_id, assigned_at, is_active, notes) VALUES (1, 3, 1, '2025-09-23 16:28:40.614', true, '');
INSERT INTO public.user_vehicle (user_vehicle_id, user_id, vehicle_id, assigned_at, is_active, notes) VALUES (2, 4, 2, '2025-09-23 16:29:05.12', true, '');
INSERT INTO public.user_vehicle (user_vehicle_id, user_id, vehicle_id, assigned_at, is_active, notes) VALUES (3, 5, 3, '2025-09-23 16:31:53.767', true, '');


--
-- Data for Name: vehicle_inventory; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: vehicle_route_inventory; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: vehicle_zone; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.vehicle_zone (vehicle_zone_id, vehicle_id, zone_id, assigned_at, is_active, notes) VALUES (1, 1, 2, '2025-09-23 16:28:35.283', true, '');
INSERT INTO public.vehicle_zone (vehicle_zone_id, vehicle_id, zone_id, assigned_at, is_active, notes) VALUES (2, 2, 3, '2025-09-23 16:29:00.714', true, '');
INSERT INTO public.vehicle_zone (vehicle_zone_id, vehicle_id, zone_id, assigned_at, is_active, notes) VALUES (3, 3, 5, '2025-09-23 16:52:50.521', true, '');


--
-- Name: RefreshToken_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."RefreshToken_id_seq"', 17, true);


--
-- Name: User_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."User_id_seq"', 5, true);


--
-- Name: cancellation_order_cancellation_order_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.cancellation_order_cancellation_order_id_seq', 7, true);


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

SELECT pg_catalog.setval('public.comodato_comodato_id_seq', 29, true);


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

SELECT pg_catalog.setval('public.customer_subscription_subscription_id_seq', 17, true);


--
-- Name: cycle_payment_payment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.cycle_payment_payment_id_seq', 12, true);


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

SELECT pg_catalog.setval('public.order_header_order_id_seq', 9, true);


--
-- Name: order_item_order_item_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.order_item_order_item_id_seq', 11, true);


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

SELECT pg_catalog.setval('public.person_person_id_seq', 6, true);


--
-- Name: price_list_history_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.price_list_history_history_id_seq', 1, false);


--
-- Name: price_list_item_price_list_item_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.price_list_item_price_list_item_id_seq', 13, true);


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

SELECT pg_catalog.setval('public.product_product_id_seq', 8, true);


--
-- Name: province_province_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.province_province_id_seq', 6, true);


--
-- Name: recovery_order_recovery_order_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.recovery_order_recovery_order_id_seq', 12, true);


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

SELECT pg_catalog.setval('public.stock_movement_stock_movement_id_seq', 8, true);


--
-- Name: subscription_cycle_cycle_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.subscription_cycle_cycle_id_seq', 17, true);


--
-- Name: subscription_cycle_detail_cycle_detail_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.subscription_cycle_detail_cycle_detail_id_seq', 34, true);


--
-- Name: subscription_delivery_schedule_schedule_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.subscription_delivery_schedule_schedule_id_seq', 40, true);


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


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
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS '';


--
-- Name: ContractStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."ContractStatus" AS ENUM (
    'ACTIVE',
    'CANCELLED',
    'EXPIRED',
    'PENDING_ACTIVATION',
    'ON_HOLD'
);


ALTER TYPE public."ContractStatus" OWNER TO postgres;

--
-- Name: OrderStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."OrderStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED',
    'PAID',
    'PARTIALLY_PAID'
);


ALTER TYPE public."OrderStatus" OWNER TO postgres;

--
-- Name: OrderType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."OrderType" AS ENUM (
    'SUBSCRIPTION',
    'ONE_OFF',
    'CONTRACT_DELIVERY'
);


ALTER TYPE public."OrderType" OWNER TO postgres;

--
-- Name: PersonType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."PersonType" AS ENUM (
    'INDIVIDUAL',
    'PLAN',
    'PROSPECT'
);


ALTER TYPE public."PersonType" OWNER TO postgres;

--
-- Name: Role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."Role" AS ENUM (
    'USER',
    'ADMIN'
);


ALTER TYPE public."Role" OWNER TO postgres;

--
-- Name: SubscriptionStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."SubscriptionStatus" AS ENUM (
    'ACTIVE',
    'PAUSED',
    'CANCELLED',
    'EXPIRED'
);


ALTER TYPE public."SubscriptionStatus" OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: RefreshToken; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."RefreshToken" (
    id integer NOT NULL,
    token text NOT NULL,
    "userId" integer NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."RefreshToken" OWNER TO postgres;

--
-- Name: RefreshToken_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."RefreshToken_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."RefreshToken_id_seq" OWNER TO postgres;

--
-- Name: RefreshToken_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."RefreshToken_id_seq" OWNED BY public."RefreshToken".id;


--
-- Name: User; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."User" (
    id integer NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    name text NOT NULL,
    role public."Role" DEFAULT 'ADMIN'::public."Role" NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone,
    "recoveryToken" text,
    "profileImageUrl" text,
    "recoveryTokenExpires" timestamp(3) without time zone
);


ALTER TABLE public."User" OWNER TO postgres;

--
-- Name: User_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."User_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."User_id_seq" OWNER TO postgres;

--
-- Name: User_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."User_id_seq" OWNED BY public."User".id;


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Name: client_contract; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.client_contract (
    contract_id integer NOT NULL,
    person_id integer NOT NULL,
    price_list_id integer NOT NULL,
    start_date date NOT NULL,
    end_date date,
    notes text,
    status public."ContractStatus" DEFAULT 'ACTIVE'::public."ContractStatus" NOT NULL
);


ALTER TABLE public.client_contract OWNER TO postgres;

--
-- Name: client_contract_contract_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.client_contract_contract_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.client_contract_contract_id_seq OWNER TO postgres;

--
-- Name: client_contract_contract_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.client_contract_contract_id_seq OWNED BY public.client_contract.contract_id;


--
-- Name: contract_delivery_schedule; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contract_delivery_schedule (
    schedule_id integer NOT NULL,
    contract_id integer NOT NULL,
    day_of_week smallint NOT NULL,
    scheduled_time time(6) without time zone NOT NULL
);


ALTER TABLE public.contract_delivery_schedule OWNER TO postgres;

--
-- Name: contract_delivery_schedule_schedule_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.contract_delivery_schedule_schedule_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.contract_delivery_schedule_schedule_id_seq OWNER TO postgres;

--
-- Name: contract_delivery_schedule_schedule_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.contract_delivery_schedule_schedule_id_seq OWNED BY public.contract_delivery_schedule.schedule_id;


--
-- Name: country; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.country (
    country_id smallint NOT NULL,
    code character varying(10) NOT NULL,
    name character varying(100) NOT NULL
);


ALTER TABLE public.country OWNER TO postgres;

--
-- Name: customer_subscription; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customer_subscription (
    subscription_id integer NOT NULL,
    customer_id integer NOT NULL,
    subscription_plan_id smallint NOT NULL,
    start_date date NOT NULL,
    end_date date,
    notes text,
    status public."SubscriptionStatus" NOT NULL
);


ALTER TABLE public.customer_subscription OWNER TO postgres;

--
-- Name: customer_subscription_subscription_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.customer_subscription_subscription_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customer_subscription_subscription_id_seq OWNER TO postgres;

--
-- Name: customer_subscription_subscription_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customer_subscription_subscription_id_seq OWNED BY public.customer_subscription.subscription_id;


--
-- Name: delivery_evidence; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.delivery_evidence (
    evidence_id integer NOT NULL,
    route_sheet_detail_id integer NOT NULL,
    evidence_type text NOT NULL,
    file_path text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by integer NOT NULL
);


ALTER TABLE public.delivery_evidence OWNER TO postgres;

--
-- Name: delivery_evidence_evidence_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.delivery_evidence_evidence_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.delivery_evidence_evidence_id_seq OWNER TO postgres;

--
-- Name: delivery_evidence_evidence_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.delivery_evidence_evidence_id_seq OWNED BY public.delivery_evidence.evidence_id;


--
-- Name: delivery_incident; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.delivery_incident (
    incident_id integer NOT NULL,
    route_sheet_detail_id integer NOT NULL,
    incident_type text NOT NULL,
    description text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by integer NOT NULL,
    status text NOT NULL,
    resolution text,
    resolved_at timestamp(3) without time zone,
    resolved_by integer
);


ALTER TABLE public.delivery_incident OWNER TO postgres;

--
-- Name: delivery_incident_incident_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.delivery_incident_incident_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.delivery_incident_incident_id_seq OWNER TO postgres;

--
-- Name: delivery_incident_incident_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.delivery_incident_incident_id_seq OWNED BY public.delivery_incident.incident_id;


--
-- Name: delivery_stats; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.delivery_stats (
    stat_id integer NOT NULL,
    date date NOT NULL,
    driver_id integer,
    vehicle_id integer,
    zone_id smallint,
    route_sheet_id integer,
    total_deliveries integer NOT NULL,
    completed_deliveries integer NOT NULL,
    rejected_deliveries integer NOT NULL,
    rescheduled_deliveries integer NOT NULL,
    avg_delivery_time integer,
    avg_delay_time integer
);


ALTER TABLE public.delivery_stats OWNER TO postgres;

--
-- Name: delivery_stats_stat_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.delivery_stats_stat_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.delivery_stats_stat_id_seq OWNER TO postgres;

--
-- Name: delivery_stats_stat_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.delivery_stats_stat_id_seq OWNED BY public.delivery_stats.stat_id;


--
-- Name: installment_order_link; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.installment_order_link (
    link_id integer NOT NULL,
    installment_id integer NOT NULL,
    order_id integer NOT NULL,
    "order_itemOrder_item_id" integer
);


ALTER TABLE public.installment_order_link OWNER TO postgres;

--
-- Name: installment_order_link_link_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.installment_order_link_link_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.installment_order_link_link_id_seq OWNER TO postgres;

--
-- Name: installment_order_link_link_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.installment_order_link_link_id_seq OWNED BY public.installment_order_link.link_id;


--
-- Name: inventory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory (
    warehouse_id smallint NOT NULL,
    product_id integer NOT NULL,
    quantity integer NOT NULL
);


ALTER TABLE public.inventory OWNER TO postgres;

--
-- Name: inventory_transaction; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory_transaction (
    transaction_id integer NOT NULL,
    route_sheet_id integer NOT NULL,
    detail_id integer,
    product_id integer NOT NULL,
    quantity integer NOT NULL,
    transaction_type text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.inventory_transaction OWNER TO postgres;

--
-- Name: inventory_transaction_transaction_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.inventory_transaction_transaction_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.inventory_transaction_transaction_id_seq OWNER TO postgres;

--
-- Name: inventory_transaction_transaction_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.inventory_transaction_transaction_id_seq OWNED BY public.inventory_transaction.transaction_id;


--
-- Name: locality; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.locality (
    locality_id smallint NOT NULL,
    province_id smallint NOT NULL,
    code character varying(10) NOT NULL,
    name character varying(100) NOT NULL
);


ALTER TABLE public.locality OWNER TO postgres;

--
-- Name: movement_type; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.movement_type (
    movement_type_id integer NOT NULL,
    code character varying(100) NOT NULL,
    description character varying(100) NOT NULL
);


ALTER TABLE public.movement_type OWNER TO postgres;

--
-- Name: movement_type_movement_type_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.movement_type ALTER COLUMN movement_type_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.movement_type_movement_type_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: one_off_purchase; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.one_off_purchase (
    purchase_id integer NOT NULL,
    person_id integer NOT NULL,
    product_id integer NOT NULL,
    quantity integer NOT NULL,
    total_amount numeric(10,2) NOT NULL,
    purchase_date timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    sale_channel_id smallint NOT NULL,
    delivery_address text,
    locality_id smallint,
    zone_id smallint
);


ALTER TABLE public.one_off_purchase OWNER TO postgres;

--
-- Name: one_off_purchase_purchase_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.one_off_purchase_purchase_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.one_off_purchase_purchase_id_seq OWNER TO postgres;

--
-- Name: one_off_purchase_purchase_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.one_off_purchase_purchase_id_seq OWNED BY public.one_off_purchase.purchase_id;


--
-- Name: order_header; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.order_header (
    order_id integer NOT NULL,
    customer_id integer NOT NULL,
    contract_id integer,
    sale_channel_id smallint DEFAULT 1 NOT NULL,
    order_date timestamp(6) without time zone NOT NULL,
    scheduled_delivery_date timestamp(6) without time zone,
    delivery_time time(6) without time zone,
    total_amount numeric(10,2) NOT NULL,
    paid_amount numeric(10,2) NOT NULL,
    notes text,
    subscription_id integer,
    order_type public."OrderType" NOT NULL,
    status public."OrderStatus" NOT NULL
);


ALTER TABLE public.order_header OWNER TO postgres;

--
-- Name: order_header_order_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.order_header_order_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.order_header_order_id_seq OWNER TO postgres;

--
-- Name: order_header_order_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.order_header_order_id_seq OWNED BY public.order_header.order_id;


--
-- Name: order_item; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.order_item (
    order_item_id integer NOT NULL,
    order_id integer NOT NULL,
    product_id integer NOT NULL,
    quantity integer NOT NULL,
    subtotal numeric(10,2) NOT NULL,
    delivered_quantity integer DEFAULT 0,
    returned_quantity integer DEFAULT 0,
    amount_paid numeric(10,2) NOT NULL,
    total_amount numeric(10,2) NOT NULL
);


ALTER TABLE public.order_item OWNER TO postgres;

--
-- Name: order_item_order_item_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.order_item_order_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.order_item_order_item_id_seq OWNER TO postgres;

--
-- Name: order_item_order_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.order_item_order_item_id_seq OWNED BY public.order_item.order_item_id;


--
-- Name: payment_installment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_installment (
    installment_id integer NOT NULL,
    customer_id integer NOT NULL,
    due_date timestamp(6) without time zone NOT NULL,
    delivered_quantity integer NOT NULL,
    amount_paid numeric(10,2) NOT NULL,
    total_amount numeric(10,2) NOT NULL
);


ALTER TABLE public.payment_installment OWNER TO postgres;

--
-- Name: payment_installment_installment_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.payment_installment_installment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payment_installment_installment_id_seq OWNER TO postgres;

--
-- Name: payment_installment_installment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.payment_installment_installment_id_seq OWNED BY public.payment_installment.installment_id;


--
-- Name: payment_line; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_line (
    payment_line_id integer NOT NULL,
    transaction_id integer NOT NULL,
    product_id integer,
    quantity integer NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    subtotal numeric(10,2) NOT NULL,
    notes text
);


ALTER TABLE public.payment_line OWNER TO postgres;

--
-- Name: payment_line_payment_line_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.payment_line_payment_line_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payment_line_payment_line_id_seq OWNER TO postgres;

--
-- Name: payment_line_payment_line_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.payment_line_payment_line_id_seq OWNED BY public.payment_line.payment_line_id;


--
-- Name: payment_method; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_method (
    payment_method_id integer NOT NULL,
    code character varying(20) NOT NULL,
    description character varying(100) NOT NULL
);


ALTER TABLE public.payment_method OWNER TO postgres;

--
-- Name: payment_method_payment_method_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.payment_method ALTER COLUMN payment_method_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.payment_method_payment_method_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: payment_transaction; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_transaction (
    transaction_id integer NOT NULL,
    transaction_date timestamp(6) without time zone NOT NULL,
    customer_id integer NOT NULL,
    order_id integer,
    document_number character varying(20) NOT NULL,
    receipt_number character varying(20),
    transaction_type character varying(10) NOT NULL,
    previous_balance numeric(10,2) NOT NULL,
    transaction_amount numeric(10,2) NOT NULL,
    total numeric(10,2) NOT NULL,
    payment_method_id smallint DEFAULT 1 NOT NULL,
    notes text,
    user_id integer
);


ALTER TABLE public.payment_transaction OWNER TO postgres;

--
-- Name: payment_transaction_transaction_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.payment_transaction_transaction_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payment_transaction_transaction_id_seq OWNER TO postgres;

--
-- Name: payment_transaction_transaction_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.payment_transaction_transaction_id_seq OWNED BY public.payment_transaction.transaction_id;


--
-- Name: person; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.person (
    person_id integer NOT NULL,
    phone character varying(20) NOT NULL,
    name character varying(100),
    tax_id character varying(20),
    address character varying(200),
    locality_id smallint,
    zone_id smallint,
    registration_date date DEFAULT CURRENT_DATE NOT NULL,
    type public."PersonType" NOT NULL,
    alias character varying(100)
);


ALTER TABLE public.person OWNER TO postgres;

--
-- Name: person_person_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.person_person_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.person_person_id_seq OWNER TO postgres;

--
-- Name: person_person_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.person_person_id_seq OWNED BY public.person.person_id;


--
-- Name: price_list; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.price_list (
    price_list_id integer NOT NULL,
    name character varying(50) NOT NULL,
    effective_date date NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    description character varying(255),
    is_default boolean DEFAULT false NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.price_list OWNER TO postgres;

--
-- Name: price_list_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.price_list_history (
    history_id integer NOT NULL,
    price_list_item_id integer NOT NULL,
    previous_price numeric(10,2) NOT NULL,
    new_price numeric(10,2) NOT NULL,
    change_date timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    change_percentage numeric(10,2),
    change_reason text,
    created_by character varying(100)
);


ALTER TABLE public.price_list_history OWNER TO postgres;

--
-- Name: price_list_history_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.price_list_history_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.price_list_history_history_id_seq OWNER TO postgres;

--
-- Name: price_list_history_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.price_list_history_history_id_seq OWNED BY public.price_list_history.history_id;


--
-- Name: price_list_item; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.price_list_item (
    price_list_item_id integer NOT NULL,
    price_list_id integer NOT NULL,
    product_id integer NOT NULL,
    unit_price numeric(10,2) NOT NULL
);


ALTER TABLE public.price_list_item OWNER TO postgres;

--
-- Name: price_list_item_price_list_item_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.price_list_item_price_list_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.price_list_item_price_list_item_id_seq OWNER TO postgres;

--
-- Name: price_list_item_price_list_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.price_list_item_price_list_item_id_seq OWNED BY public.price_list_item.price_list_item_id;


--
-- Name: price_list_price_list_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.price_list_price_list_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.price_list_price_list_id_seq OWNER TO postgres;

--
-- Name: price_list_price_list_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.price_list_price_list_id_seq OWNED BY public.price_list.price_list_id;


--
-- Name: product; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product (
    product_id integer NOT NULL,
    category_id smallint NOT NULL,
    description character varying(100) NOT NULL,
    volume_liters numeric(5,2),
    price numeric(10,2) NOT NULL,
    is_returnable boolean NOT NULL,
    serial_number character varying(50),
    notes text,
    image_url character varying(255)
);


ALTER TABLE public.product OWNER TO postgres;

--
-- Name: product_category; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_category (
    category_id smallint NOT NULL,
    name character varying(50) NOT NULL
);


ALTER TABLE public.product_category OWNER TO postgres;

--
-- Name: product_category_category_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.product_category_category_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.product_category_category_id_seq OWNER TO postgres;

--
-- Name: product_category_category_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.product_category_category_id_seq OWNED BY public.product_category.category_id;


--
-- Name: product_product_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.product_product_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.product_product_id_seq OWNER TO postgres;

--
-- Name: product_product_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.product_product_id_seq OWNED BY public.product.product_id;


--
-- Name: province; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.province (
    province_id smallint NOT NULL,
    country_id smallint NOT NULL,
    code character varying(10) NOT NULL,
    name character varying(100) NOT NULL
);


ALTER TABLE public.province OWNER TO postgres;

--
-- Name: route_optimization; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.route_optimization (
    optimization_id integer NOT NULL,
    route_sheet_id integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    estimated_duration integer NOT NULL,
    estimated_distance numeric(10,2) NOT NULL,
    optimization_status text NOT NULL,
    waypoints jsonb
);


ALTER TABLE public.route_optimization OWNER TO postgres;

--
-- Name: route_optimization_optimization_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.route_optimization_optimization_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.route_optimization_optimization_id_seq OWNER TO postgres;

--
-- Name: route_optimization_optimization_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.route_optimization_optimization_id_seq OWNED BY public.route_optimization.optimization_id;


--
-- Name: route_sheet; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.route_sheet (
    route_sheet_id integer NOT NULL,
    driver_id integer NOT NULL,
    vehicle_id smallint NOT NULL,
    delivery_date date NOT NULL,
    route_notes text,
    driver_reconciliation_signature_path text,
    reconciliation_at timestamp(3) without time zone
);


ALTER TABLE public.route_sheet OWNER TO postgres;

--
-- Name: route_sheet_detail; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.route_sheet_detail (
    route_sheet_detail_id integer NOT NULL,
    route_sheet_id integer NOT NULL,
    order_id integer NOT NULL,
    delivery_status character varying(20) NOT NULL,
    delivery_time timestamp(6) without time zone,
    comments text,
    digital_signature_id character varying(100),
    actual_arrival_time timestamp(3) without time zone,
    delivery_notes text,
    estimated_arrival_time timestamp(3) without time zone,
    lat numeric(10,8),
    lng numeric(10,8),
    recipient_name text,
    rejection_reason text,
    reschedule_date timestamp(3) without time zone,
    sequence_number integer
);


ALTER TABLE public.route_sheet_detail OWNER TO postgres;

--
-- Name: route_sheet_detail_route_sheet_detail_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.route_sheet_detail_route_sheet_detail_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.route_sheet_detail_route_sheet_detail_id_seq OWNER TO postgres;

--
-- Name: route_sheet_detail_route_sheet_detail_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.route_sheet_detail_route_sheet_detail_id_seq OWNED BY public.route_sheet_detail.route_sheet_detail_id;


--
-- Name: route_sheet_route_sheet_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.route_sheet_route_sheet_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.route_sheet_route_sheet_id_seq OWNER TO postgres;

--
-- Name: route_sheet_route_sheet_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.route_sheet_route_sheet_id_seq OWNED BY public.route_sheet.route_sheet_id;


--
-- Name: sale_channel; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sale_channel (
    sale_channel_id integer NOT NULL,
    code character varying(20) NOT NULL,
    description character varying(100) NOT NULL
);


ALTER TABLE public.sale_channel OWNER TO postgres;

--
-- Name: sale_channel_sale_channel_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.sale_channel ALTER COLUMN sale_channel_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.sale_channel_sale_channel_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: stock_movement; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_movement (
    stock_movement_id integer NOT NULL,
    movement_date timestamp(6) without time zone NOT NULL,
    movement_type_id smallint NOT NULL,
    product_id integer NOT NULL,
    source_warehouse_id smallint,
    destination_warehouse_id smallint,
    quantity integer NOT NULL,
    remarks text,
    order_id integer,
    reference_document character varying(50),
    user_id integer
);


ALTER TABLE public.stock_movement OWNER TO postgres;

--
-- Name: stock_movement_stock_movement_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stock_movement_stock_movement_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stock_movement_stock_movement_id_seq OWNER TO postgres;

--
-- Name: stock_movement_stock_movement_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.stock_movement_stock_movement_id_seq OWNED BY public.stock_movement.stock_movement_id;


--
-- Name: subscription_cycle; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subscription_cycle (
    cycle_id integer NOT NULL,
    subscription_id integer NOT NULL,
    cycle_start date NOT NULL,
    cycle_end date NOT NULL,
    notes text
);


ALTER TABLE public.subscription_cycle OWNER TO postgres;

--
-- Name: subscription_cycle_cycle_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.subscription_cycle_cycle_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.subscription_cycle_cycle_id_seq OWNER TO postgres;

--
-- Name: subscription_cycle_cycle_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.subscription_cycle_cycle_id_seq OWNED BY public.subscription_cycle.cycle_id;


--
-- Name: subscription_cycle_detail; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subscription_cycle_detail (
    cycle_detail_id integer NOT NULL,
    cycle_id integer NOT NULL,
    product_id integer NOT NULL,
    planned_quantity integer NOT NULL,
    delivered_quantity integer DEFAULT 0 NOT NULL,
    remaining_balance integer NOT NULL
);


ALTER TABLE public.subscription_cycle_detail OWNER TO postgres;

--
-- Name: subscription_cycle_detail_cycle_detail_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.subscription_cycle_detail_cycle_detail_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.subscription_cycle_detail_cycle_detail_id_seq OWNER TO postgres;

--
-- Name: subscription_cycle_detail_cycle_detail_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.subscription_cycle_detail_cycle_detail_id_seq OWNED BY public.subscription_cycle_detail.cycle_detail_id;


--
-- Name: subscription_delivery_schedule; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subscription_delivery_schedule (
    schedule_id integer NOT NULL,
    subscription_id integer NOT NULL,
    day_of_week smallint NOT NULL,
    scheduled_time character varying(20) NOT NULL
);


ALTER TABLE public.subscription_delivery_schedule OWNER TO postgres;

--
-- Name: subscription_delivery_schedule_schedule_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.subscription_delivery_schedule_schedule_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.subscription_delivery_schedule_schedule_id_seq OWNER TO postgres;

--
-- Name: subscription_delivery_schedule_schedule_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.subscription_delivery_schedule_schedule_id_seq OWNED BY public.subscription_delivery_schedule.schedule_id;


--
-- Name: subscription_plan; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subscription_plan (
    subscription_plan_id smallint NOT NULL,
    name character varying(50) NOT NULL,
    description text,
    price numeric(10,2),
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    default_cycle_days integer DEFAULT 30 NOT NULL,
    default_deliveries_per_cycle integer DEFAULT 1 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.subscription_plan OWNER TO postgres;

--
-- Name: subscription_plan_product; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subscription_plan_product (
    spp_id integer NOT NULL,
    subscription_plan_id smallint NOT NULL,
    product_id integer NOT NULL,
    product_quantity integer NOT NULL
);


ALTER TABLE public.subscription_plan_product OWNER TO postgres;

--
-- Name: subscription_plan_product_spp_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.subscription_plan_product_spp_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.subscription_plan_product_spp_id_seq OWNER TO postgres;

--
-- Name: subscription_plan_product_spp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.subscription_plan_product_spp_id_seq OWNED BY public.subscription_plan_product.spp_id;


--
-- Name: subscription_plan_subscription_plan_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.subscription_plan_subscription_plan_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.subscription_plan_subscription_plan_id_seq OWNER TO postgres;

--
-- Name: subscription_plan_subscription_plan_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.subscription_plan_subscription_plan_id_seq OWNED BY public.subscription_plan.subscription_plan_id;


--
-- Name: user_vehicle; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_vehicle (
    user_vehicle_id integer NOT NULL,
    user_id integer NOT NULL,
    vehicle_id smallint NOT NULL,
    assigned_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    notes text
);


ALTER TABLE public.user_vehicle OWNER TO postgres;

--
-- Name: user_vehicle_user_vehicle_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_vehicle_user_vehicle_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_vehicle_user_vehicle_id_seq OWNER TO postgres;

--
-- Name: user_vehicle_user_vehicle_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_vehicle_user_vehicle_id_seq OWNED BY public.user_vehicle.user_vehicle_id;


--
-- Name: vehicle; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vehicle (
    vehicle_id smallint NOT NULL,
    code character varying(20) NOT NULL,
    name character varying(50) NOT NULL,
    description text
);


ALTER TABLE public.vehicle OWNER TO postgres;

--
-- Name: vehicle_inventory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vehicle_inventory (
    vehicle_id smallint NOT NULL,
    product_id integer NOT NULL,
    quantity_loaded integer NOT NULL,
    quantity_empty integer
);


ALTER TABLE public.vehicle_inventory OWNER TO postgres;

--
-- Name: vehicle_route_inventory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vehicle_route_inventory (
    inventory_id integer NOT NULL,
    route_sheet_id integer NOT NULL,
    product_id integer NOT NULL,
    initial_quantity integer NOT NULL,
    current_quantity integer NOT NULL,
    returned_quantity integer NOT NULL
);


ALTER TABLE public.vehicle_route_inventory OWNER TO postgres;

--
-- Name: vehicle_route_inventory_inventory_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.vehicle_route_inventory_inventory_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vehicle_route_inventory_inventory_id_seq OWNER TO postgres;

--
-- Name: vehicle_route_inventory_inventory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.vehicle_route_inventory_inventory_id_seq OWNED BY public.vehicle_route_inventory.inventory_id;


--
-- Name: vehicle_vehicle_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.vehicle_vehicle_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vehicle_vehicle_id_seq OWNER TO postgres;

--
-- Name: vehicle_vehicle_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.vehicle_vehicle_id_seq OWNED BY public.vehicle.vehicle_id;


--
-- Name: vehicle_zone; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vehicle_zone (
    vehicle_zone_id integer NOT NULL,
    vehicle_id smallint NOT NULL,
    zone_id smallint NOT NULL,
    assigned_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    notes text
);


ALTER TABLE public.vehicle_zone OWNER TO postgres;

--
-- Name: vehicle_zone_vehicle_zone_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.vehicle_zone_vehicle_zone_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vehicle_zone_vehicle_zone_id_seq OWNER TO postgres;

--
-- Name: vehicle_zone_vehicle_zone_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.vehicle_zone_vehicle_zone_id_seq OWNED BY public.vehicle_zone.vehicle_zone_id;


--
-- Name: warehouse; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.warehouse (
    warehouse_id integer NOT NULL,
    name character varying(100) NOT NULL,
    locality_id smallint
);


ALTER TABLE public.warehouse OWNER TO postgres;

--
-- Name: warehouse_warehouse_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.warehouse ALTER COLUMN warehouse_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.warehouse_warehouse_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: zone; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.zone (
    zone_id smallint NOT NULL,
    code character varying(10) NOT NULL,
    name character varying(100) NOT NULL,
    locality_id smallint NOT NULL
);


ALTER TABLE public.zone OWNER TO postgres;

--
-- Name: zone_zone_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.zone_zone_id_seq
    AS smallint
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.zone_zone_id_seq OWNER TO postgres;

--
-- Name: zone_zone_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.zone_zone_id_seq OWNED BY public.zone.zone_id;


--
-- Name: RefreshToken id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."RefreshToken" ALTER COLUMN id SET DEFAULT nextval('public."RefreshToken_id_seq"'::regclass);


--
-- Name: User id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User" ALTER COLUMN id SET DEFAULT nextval('public."User_id_seq"'::regclass);


--
-- Name: client_contract contract_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_contract ALTER COLUMN contract_id SET DEFAULT nextval('public.client_contract_contract_id_seq'::regclass);


--
-- Name: contract_delivery_schedule schedule_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_delivery_schedule ALTER COLUMN schedule_id SET DEFAULT nextval('public.contract_delivery_schedule_schedule_id_seq'::regclass);


--
-- Name: customer_subscription subscription_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_subscription ALTER COLUMN subscription_id SET DEFAULT nextval('public.customer_subscription_subscription_id_seq'::regclass);


--
-- Name: delivery_evidence evidence_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_evidence ALTER COLUMN evidence_id SET DEFAULT nextval('public.delivery_evidence_evidence_id_seq'::regclass);


--
-- Name: delivery_incident incident_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_incident ALTER COLUMN incident_id SET DEFAULT nextval('public.delivery_incident_incident_id_seq'::regclass);


--
-- Name: delivery_stats stat_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_stats ALTER COLUMN stat_id SET DEFAULT nextval('public.delivery_stats_stat_id_seq'::regclass);


--
-- Name: installment_order_link link_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.installment_order_link ALTER COLUMN link_id SET DEFAULT nextval('public.installment_order_link_link_id_seq'::regclass);


--
-- Name: inventory_transaction transaction_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_transaction ALTER COLUMN transaction_id SET DEFAULT nextval('public.inventory_transaction_transaction_id_seq'::regclass);


--
-- Name: one_off_purchase purchase_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.one_off_purchase ALTER COLUMN purchase_id SET DEFAULT nextval('public.one_off_purchase_purchase_id_seq'::regclass);


--
-- Name: order_header order_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_header ALTER COLUMN order_id SET DEFAULT nextval('public.order_header_order_id_seq'::regclass);


--
-- Name: order_item order_item_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_item ALTER COLUMN order_item_id SET DEFAULT nextval('public.order_item_order_item_id_seq'::regclass);


--
-- Name: payment_installment installment_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_installment ALTER COLUMN installment_id SET DEFAULT nextval('public.payment_installment_installment_id_seq'::regclass);


--
-- Name: payment_line payment_line_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_line ALTER COLUMN payment_line_id SET DEFAULT nextval('public.payment_line_payment_line_id_seq'::regclass);


--
-- Name: payment_transaction transaction_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_transaction ALTER COLUMN transaction_id SET DEFAULT nextval('public.payment_transaction_transaction_id_seq'::regclass);


--
-- Name: person person_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person ALTER COLUMN person_id SET DEFAULT nextval('public.person_person_id_seq'::regclass);


--
-- Name: price_list price_list_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.price_list ALTER COLUMN price_list_id SET DEFAULT nextval('public.price_list_price_list_id_seq'::regclass);


--
-- Name: price_list_history history_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.price_list_history ALTER COLUMN history_id SET DEFAULT nextval('public.price_list_history_history_id_seq'::regclass);


--
-- Name: price_list_item price_list_item_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.price_list_item ALTER COLUMN price_list_item_id SET DEFAULT nextval('public.price_list_item_price_list_item_id_seq'::regclass);


--
-- Name: product product_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product ALTER COLUMN product_id SET DEFAULT nextval('public.product_product_id_seq'::regclass);


--
-- Name: product_category category_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_category ALTER COLUMN category_id SET DEFAULT nextval('public.product_category_category_id_seq'::regclass);


--
-- Name: route_optimization optimization_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.route_optimization ALTER COLUMN optimization_id SET DEFAULT nextval('public.route_optimization_optimization_id_seq'::regclass);


--
-- Name: route_sheet route_sheet_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.route_sheet ALTER COLUMN route_sheet_id SET DEFAULT nextval('public.route_sheet_route_sheet_id_seq'::regclass);


--
-- Name: route_sheet_detail route_sheet_detail_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.route_sheet_detail ALTER COLUMN route_sheet_detail_id SET DEFAULT nextval('public.route_sheet_detail_route_sheet_detail_id_seq'::regclass);


--
-- Name: stock_movement stock_movement_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movement ALTER COLUMN stock_movement_id SET DEFAULT nextval('public.stock_movement_stock_movement_id_seq'::regclass);


--
-- Name: subscription_cycle cycle_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_cycle ALTER COLUMN cycle_id SET DEFAULT nextval('public.subscription_cycle_cycle_id_seq'::regclass);


--
-- Name: subscription_cycle_detail cycle_detail_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_cycle_detail ALTER COLUMN cycle_detail_id SET DEFAULT nextval('public.subscription_cycle_detail_cycle_detail_id_seq'::regclass);


--
-- Name: subscription_delivery_schedule schedule_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_delivery_schedule ALTER COLUMN schedule_id SET DEFAULT nextval('public.subscription_delivery_schedule_schedule_id_seq'::regclass);


--
-- Name: subscription_plan subscription_plan_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_plan ALTER COLUMN subscription_plan_id SET DEFAULT nextval('public.subscription_plan_subscription_plan_id_seq'::regclass);


--
-- Name: subscription_plan_product spp_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_plan_product ALTER COLUMN spp_id SET DEFAULT nextval('public.subscription_plan_product_spp_id_seq'::regclass);


--
-- Name: user_vehicle user_vehicle_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_vehicle ALTER COLUMN user_vehicle_id SET DEFAULT nextval('public.user_vehicle_user_vehicle_id_seq'::regclass);


--
-- Name: vehicle vehicle_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicle ALTER COLUMN vehicle_id SET DEFAULT nextval('public.vehicle_vehicle_id_seq'::regclass);


--
-- Name: vehicle_route_inventory inventory_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicle_route_inventory ALTER COLUMN inventory_id SET DEFAULT nextval('public.vehicle_route_inventory_inventory_id_seq'::regclass);


--
-- Name: vehicle_zone vehicle_zone_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicle_zone ALTER COLUMN vehicle_zone_id SET DEFAULT nextval('public.vehicle_zone_vehicle_zone_id_seq'::regclass);


--
-- Name: zone zone_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zone ALTER COLUMN zone_id SET DEFAULT nextval('public.zone_zone_id_seq'::regclass);


--
-- Data for Name: RefreshToken; Type: TABLE DATA; Schema: public; Owner: postgres
--

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


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."User" (id, email, password, name, role, "isActive", "createdAt", "updatedAt", "recoveryToken", "profileImageUrl", "recoveryTokenExpires") FROM stdin;
1	zeniquelrober@gmail.com	$2b$10$2v/ypzG5YCjz7yT5/m8qiuKcDAhLHMTRau7IcltNjPeaEkFKDr9qK	rober zeniquel	ADMIN	t	2025-07-04 22:30:13.354	\N	\N	\N	\N
2	facuzeniquel@gmai.com	$2b$10$zc6bHryAmWAxZUlNfPnK2uAnRbvXwfNosI4IrqwtSr7spLKH.T3se	Facundo Zeniquel	USER	t	2025-07-05 17:15:39.667	\N	\N	\N	\N
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

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


--
-- Data for Name: client_contract; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.client_contract (contract_id, person_id, price_list_id, start_date, end_date, notes, status) FROM stdin;
\.


--
-- Data for Name: contract_delivery_schedule; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.contract_delivery_schedule (schedule_id, contract_id, day_of_week, scheduled_time) FROM stdin;
\.


--
-- Data for Name: country; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.country (country_id, code, name) FROM stdin;
1	AR	Argentina
2	PY	Paraguay
\.


--
-- Data for Name: customer_subscription; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customer_subscription (subscription_id, customer_id, subscription_plan_id, start_date, end_date, notes, status) FROM stdin;
1	1	1	2025-07-05	2025-12-05	{"original_notes":"Suscripción mensual","delivery_preferences":{"preferred_time_range":"09:00-12:00","preferred_days":["MONDAY","WEDNESDAY","FRIDAY"],"avoid_times":["12:00-13:00"],"special_instructions":"Llamar antes de llegar"}}	ACTIVE
2	1	2	2025-07-07	2025-08-08	{"delivery_preferences":{"preferred_time_range":"13:34-18:05","preferred_days":["TUESDAY","THURSDAY","SUNDAY"],"avoid_times":["08:31-10:29"],"special_instructions":"Tocar timbre"}}	ACTIVE
3	6	1	2025-07-07	2025-08-08	{"original_notes":"holaaaaaaaaaaaaaaaaaaaaaaaa","delivery_preferences":{"preferred_time_range":"15:20-18:24","preferred_days":["MONDAY","WEDNESDAY","TUESDAY"],"avoid_times":["17:24-20:24"],"special_instructions":"Avisar antes de ir"}}	ACTIVE
4	6	2	2025-07-07	2025-08-07	{"delivery_preferences":{"preferred_time_range":"10:43","preferred_days":["THURSDAY"],"avoid_times":["23:45"],"special_instructions":"Avisar antes"}}	ACTIVE
\.


--
-- Data for Name: delivery_evidence; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.delivery_evidence (evidence_id, route_sheet_detail_id, evidence_type, file_path, created_at, created_by) FROM stdin;
\.


--
-- Data for Name: delivery_incident; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.delivery_incident (incident_id, route_sheet_detail_id, incident_type, description, created_at, created_by, status, resolution, resolved_at, resolved_by) FROM stdin;
\.


--
-- Data for Name: delivery_stats; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.delivery_stats (stat_id, date, driver_id, vehicle_id, zone_id, route_sheet_id, total_deliveries, completed_deliveries, rejected_deliveries, rescheduled_deliveries, avg_delivery_time, avg_delay_time) FROM stdin;
\.


--
-- Data for Name: installment_order_link; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.installment_order_link (link_id, installment_id, order_id, "order_itemOrder_item_id") FROM stdin;
\.


--
-- Data for Name: inventory; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory (warehouse_id, product_id, quantity) FROM stdin;
1	1	100
1	2	50
1	3	100
\.


--
-- Data for Name: inventory_transaction; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory_transaction (transaction_id, route_sheet_id, detail_id, product_id, quantity, transaction_type, created_at) FROM stdin;
\.


--
-- Data for Name: locality; Type: TABLE DATA; Schema: public; Owner: postgres
--

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


--
-- Data for Name: movement_type; Type: TABLE DATA; Schema: public; Owner: postgres
--

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


--
-- Data for Name: one_off_purchase; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.one_off_purchase (purchase_id, person_id, product_id, quantity, total_amount, purchase_date, sale_channel_id, delivery_address, locality_id, zone_id) FROM stdin;
\.


--
-- Data for Name: order_header; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.order_header (order_id, customer_id, contract_id, sale_channel_id, order_date, scheduled_delivery_date, delivery_time, total_amount, paid_amount, notes, subscription_id, order_type, status) FROM stdin;
\.


--
-- Data for Name: order_item; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.order_item (order_item_id, order_id, product_id, quantity, subtotal, delivered_quantity, returned_quantity, amount_paid, total_amount) FROM stdin;
\.


--
-- Data for Name: payment_installment; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payment_installment (installment_id, customer_id, due_date, delivered_quantity, amount_paid, total_amount) FROM stdin;
\.


--
-- Data for Name: payment_line; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payment_line (payment_line_id, transaction_id, product_id, quantity, unit_price, subtotal, notes) FROM stdin;
\.


--
-- Data for Name: payment_method; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payment_method (payment_method_id, code, description) FROM stdin;
\.


--
-- Data for Name: payment_transaction; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payment_transaction (transaction_id, transaction_date, customer_id, order_id, document_number, receipt_number, transaction_type, previous_balance, transaction_amount, total, payment_method_id, notes, user_id) FROM stdin;
\.


--
-- Data for Name: person; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.person (person_id, phone, name, tax_id, address, locality_id, zone_id, registration_date, type, alias) FROM stdin;
1	123123123	Matias	20364567653	peredo 123	1	2	2025-07-04	PLAN	\N
4	362412233423	Facundo	20234564564	av 25 de mayo 1234	1	2	2025-07-05	INDIVIDUAL	\N
5	15345334534512	juancito	20652344564	av.libre 1234	1	2	2025-07-05	INDIVIDUAL	\N
7	34234234234	migueleto	20534535324	sdfsdfo234	1	2	2025-07-05	INDIVIDUAL	Migueleto Kiosco
6	456434534	josecito	204556445644	av. 9 de julio 1050	1	2	2025-07-05	PLAN	Colombraro
\.


--
-- Data for Name: price_list; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.price_list (price_list_id, name, effective_date, active, created_at, description, is_default, updated_at) FROM stdin;
2	Mayoristas	2025-07-05	t	2025-07-05 16:57:12.206	Lista de precio Mayoristas	f	2025-07-05 16:57:12.206
1	Lista General/Estándar	2025-07-04	t	2025-07-04 22:39:46.663	Lista de precios General Inicial	t	2025-07-05 16:58:19.191
\.


--
-- Data for Name: price_list_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.price_list_history (history_id, price_list_item_id, previous_price, new_price, change_date, change_percentage, change_reason, created_by) FROM stdin;
2	2	15000.00	16500.00	2025-07-04 22:54:54.435	10.00	inflacion julio	\N
3	3	500.00	550.00	2025-07-04 22:54:54.446	10.00	inflacion julio	\N
\.


--
-- Data for Name: price_list_item; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.price_list_item (price_list_item_id, price_list_id, product_id, unit_price) FROM stdin;
2	1	2	16500.00
3	1	3	550.00
4	1	1	5000.00
6	2	3	300.00
7	2	2	200.00
\.


--
-- Data for Name: product; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product (product_id, category_id, description, volume_liters, price, is_returnable, serial_number, notes, image_url) FROM stdin;
1	1	Bidon 12LTS	12.00	1000.00	t	123	Bidon 12LTS retornable	\N
2	2	Dispenser Agua Fria	0.00	15000.00	f	123	Dispenser Agua Fria	\N
3	1	Bidon 5LTS	5.00	500.00	t	123	Bidon 5LTS retornable	\N
\.


--
-- Data for Name: product_category; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product_category (category_id, name) FROM stdin;
1	Bidones
2	Dispensers
\.


--
-- Data for Name: province; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.province (province_id, country_id, code, name) FROM stdin;
1	1	CH	Chaco
2	1	CO	Corrientes
3	1	FO	Formosa
4	1	MI	Misiones
5	1	SF	Santa Fe
6	2	DC	Distrito Capital
\.


--
-- Data for Name: route_optimization; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.route_optimization (optimization_id, route_sheet_id, created_at, estimated_duration, estimated_distance, optimization_status, waypoints) FROM stdin;
\.


--
-- Data for Name: route_sheet; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.route_sheet (route_sheet_id, driver_id, vehicle_id, delivery_date, route_notes, driver_reconciliation_signature_path, reconciliation_at) FROM stdin;
\.


--
-- Data for Name: route_sheet_detail; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.route_sheet_detail (route_sheet_detail_id, route_sheet_id, order_id, delivery_status, delivery_time, comments, digital_signature_id, actual_arrival_time, delivery_notes, estimated_arrival_time, lat, lng, recipient_name, rejection_reason, reschedule_date, sequence_number) FROM stdin;
\.


--
-- Data for Name: sale_channel; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sale_channel (sale_channel_id, code, description) FROM stdin;
1	PRESENCIAL	Venta presencial en local
2	WHATSAPP	Venta realizada por WhatsApp
\.


--
-- Data for Name: stock_movement; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stock_movement (stock_movement_id, movement_date, movement_type_id, product_id, source_warehouse_id, destination_warehouse_id, quantity, remarks, order_id, reference_document, user_id) FROM stdin;
1	2025-07-04 22:39:46.779	1	1	\N	1	100	Stock inicial - Bidon 12LTS	\N	\N	\N
2	2025-07-04 22:40:17.834	1	2	\N	1	50	Stock inicial - Dispenser Agua Fria	\N	\N	\N
3	2025-07-04 22:40:46.717	1	3	\N	1	100	Stock inicial - Bidon 5LTS	\N	\N	\N
\.


--
-- Data for Name: subscription_cycle; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.subscription_cycle (cycle_id, subscription_id, cycle_start, cycle_end, notes) FROM stdin;
\.


--
-- Data for Name: subscription_cycle_detail; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.subscription_cycle_detail (cycle_detail_id, cycle_id, product_id, planned_quantity, delivered_quantity, remaining_balance) FROM stdin;
\.


--
-- Data for Name: subscription_delivery_schedule; Type: TABLE DATA; Schema: public; Owner: postgres
--

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


--
-- Data for Name: subscription_plan; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.subscription_plan (subscription_plan_id, name, description, price, created_at, default_cycle_days, default_deliveries_per_cycle, is_active, updated_at) FROM stdin;
2	Abono quincenal	Abono Quincenal	2000.00	2025-07-05 22:43:34.164	15	2	t	2025-07-05 22:43:34.164
1	Abono Mensual 12 LTS	Abono Mensual	12000.00	2025-07-04 22:36:35.244	30	1	t	2025-07-07 19:17:19.872
\.


--
-- Data for Name: subscription_plan_product; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.subscription_plan_product (spp_id, subscription_plan_id, product_id, product_quantity) FROM stdin;
1	1	1	6
2	1	2	1
3	2	3	3
5	2	2	1
\.


--
-- Data for Name: user_vehicle; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_vehicle (user_vehicle_id, user_id, vehicle_id, assigned_at, is_active, notes) FROM stdin;
\.


--
-- Data for Name: vehicle; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vehicle (vehicle_id, code, name, description) FROM stdin;
1	TRK-001	Merccedes Benz	Camion de carga
\.


--
-- Data for Name: vehicle_inventory; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vehicle_inventory (vehicle_id, product_id, quantity_loaded, quantity_empty) FROM stdin;
\.


--
-- Data for Name: vehicle_route_inventory; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vehicle_route_inventory (inventory_id, route_sheet_id, product_id, initial_quantity, current_quantity, returned_quantity) FROM stdin;
\.


--
-- Data for Name: vehicle_zone; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vehicle_zone (vehicle_zone_id, vehicle_id, zone_id, assigned_at, is_active, notes) FROM stdin;
1	1	1	2025-07-04 22:45:00.829	t	Asignación para ruta matutina
\.


--
-- Data for Name: warehouse; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.warehouse (warehouse_id, name, locality_id) FROM stdin;
1	Central	\N
\.


--
-- Data for Name: zone; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.zone (zone_id, code, name, locality_id) FROM stdin;
1	ZS-001	Zona Sur	1
2	ZN-res	Zona Norte	1
\.


--
-- Name: RefreshToken_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."RefreshToken_id_seq"', 11, true);


--
-- Name: User_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."User_id_seq"', 2, true);


--
-- Name: client_contract_contract_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.client_contract_contract_id_seq', 1, false);


--
-- Name: contract_delivery_schedule_schedule_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.contract_delivery_schedule_schedule_id_seq', 1, false);


--
-- Name: customer_subscription_subscription_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.customer_subscription_subscription_id_seq', 4, true);


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
-- Name: movement_type_movement_type_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.movement_type_movement_type_id_seq', 12, true);


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

SELECT pg_catalog.setval('public.person_person_id_seq', 7, true);


--
-- Name: price_list_history_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.price_list_history_history_id_seq', 3, true);


--
-- Name: price_list_item_price_list_item_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.price_list_item_price_list_item_id_seq', 8, true);


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

SELECT pg_catalog.setval('public.product_product_id_seq', 3, true);


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

SELECT pg_catalog.setval('public.stock_movement_stock_movement_id_seq', 3, true);


--
-- Name: subscription_cycle_cycle_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.subscription_cycle_cycle_id_seq', 1, false);


--
-- Name: subscription_cycle_detail_cycle_detail_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.subscription_cycle_detail_cycle_detail_id_seq', 1, false);


--
-- Name: subscription_delivery_schedule_schedule_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.subscription_delivery_schedule_schedule_id_seq', 10, true);


--
-- Name: subscription_plan_product_spp_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.subscription_plan_product_spp_id_seq', 5, true);


--
-- Name: subscription_plan_subscription_plan_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.subscription_plan_subscription_plan_id_seq', 2, true);


--
-- Name: user_vehicle_user_vehicle_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_vehicle_user_vehicle_id_seq', 1, false);


--
-- Name: vehicle_route_inventory_inventory_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.vehicle_route_inventory_inventory_id_seq', 1, false);


--
-- Name: vehicle_vehicle_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.vehicle_vehicle_id_seq', 1, true);


--
-- Name: vehicle_zone_vehicle_zone_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.vehicle_zone_vehicle_zone_id_seq', 1, true);


--
-- Name: warehouse_warehouse_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.warehouse_warehouse_id_seq', 3, true);


--
-- Name: zone_zone_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.zone_zone_id_seq', 2, true);


--
-- Name: RefreshToken RefreshToken_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."RefreshToken"
    ADD CONSTRAINT "RefreshToken_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: client_contract client_contract_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_contract
    ADD CONSTRAINT client_contract_pkey PRIMARY KEY (contract_id);


--
-- Name: contract_delivery_schedule contract_delivery_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_delivery_schedule
    ADD CONSTRAINT contract_delivery_schedule_pkey PRIMARY KEY (schedule_id);


--
-- Name: country country_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.country
    ADD CONSTRAINT country_pkey PRIMARY KEY (country_id);


--
-- Name: customer_subscription customer_subscription_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_subscription
    ADD CONSTRAINT customer_subscription_pkey PRIMARY KEY (subscription_id);


--
-- Name: delivery_evidence delivery_evidence_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_evidence
    ADD CONSTRAINT delivery_evidence_pkey PRIMARY KEY (evidence_id);


--
-- Name: delivery_incident delivery_incident_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_incident
    ADD CONSTRAINT delivery_incident_pkey PRIMARY KEY (incident_id);


--
-- Name: delivery_stats delivery_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_stats
    ADD CONSTRAINT delivery_stats_pkey PRIMARY KEY (stat_id);


--
-- Name: installment_order_link installment_order_link_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.installment_order_link
    ADD CONSTRAINT installment_order_link_pkey PRIMARY KEY (link_id);


--
-- Name: inventory inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_pkey PRIMARY KEY (warehouse_id, product_id);


--
-- Name: inventory_transaction inventory_transaction_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_transaction
    ADD CONSTRAINT inventory_transaction_pkey PRIMARY KEY (transaction_id);


--
-- Name: locality locality_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.locality
    ADD CONSTRAINT locality_pkey PRIMARY KEY (locality_id);


--
-- Name: movement_type movement_type_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movement_type
    ADD CONSTRAINT movement_type_pkey PRIMARY KEY (movement_type_id);


--
-- Name: one_off_purchase one_off_purchase_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.one_off_purchase
    ADD CONSTRAINT one_off_purchase_pkey PRIMARY KEY (purchase_id);


--
-- Name: order_header order_header_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_header
    ADD CONSTRAINT order_header_pkey PRIMARY KEY (order_id);


--
-- Name: order_item order_item_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_item
    ADD CONSTRAINT order_item_pkey PRIMARY KEY (order_item_id);


--
-- Name: payment_installment payment_installment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_installment
    ADD CONSTRAINT payment_installment_pkey PRIMARY KEY (installment_id);


--
-- Name: payment_line payment_line_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_line
    ADD CONSTRAINT payment_line_pkey PRIMARY KEY (payment_line_id);


--
-- Name: payment_method payment_method_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_method
    ADD CONSTRAINT payment_method_pkey PRIMARY KEY (payment_method_id);


--
-- Name: payment_transaction payment_transaction_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_transaction
    ADD CONSTRAINT payment_transaction_pkey PRIMARY KEY (transaction_id);


--
-- Name: person person_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person
    ADD CONSTRAINT person_pkey PRIMARY KEY (person_id);


--
-- Name: price_list_history price_list_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.price_list_history
    ADD CONSTRAINT price_list_history_pkey PRIMARY KEY (history_id);


--
-- Name: price_list_item price_list_item_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.price_list_item
    ADD CONSTRAINT price_list_item_pkey PRIMARY KEY (price_list_item_id);


--
-- Name: price_list price_list_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.price_list
    ADD CONSTRAINT price_list_pkey PRIMARY KEY (price_list_id);


--
-- Name: product_category product_category_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_category
    ADD CONSTRAINT product_category_pkey PRIMARY KEY (category_id);


--
-- Name: product product_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT product_pkey PRIMARY KEY (product_id);


--
-- Name: province province_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.province
    ADD CONSTRAINT province_pkey PRIMARY KEY (province_id);


--
-- Name: route_optimization route_optimization_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.route_optimization
    ADD CONSTRAINT route_optimization_pkey PRIMARY KEY (optimization_id);


--
-- Name: route_sheet_detail route_sheet_detail_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.route_sheet_detail
    ADD CONSTRAINT route_sheet_detail_pkey PRIMARY KEY (route_sheet_detail_id);


--
-- Name: route_sheet route_sheet_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.route_sheet
    ADD CONSTRAINT route_sheet_pkey PRIMARY KEY (route_sheet_id);


--
-- Name: sale_channel sale_channel_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_channel
    ADD CONSTRAINT sale_channel_pkey PRIMARY KEY (sale_channel_id);


--
-- Name: stock_movement stock_movement_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movement
    ADD CONSTRAINT stock_movement_pkey PRIMARY KEY (stock_movement_id);


--
-- Name: subscription_cycle_detail subscription_cycle_detail_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_cycle_detail
    ADD CONSTRAINT subscription_cycle_detail_pkey PRIMARY KEY (cycle_detail_id);


--
-- Name: subscription_cycle subscription_cycle_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_cycle
    ADD CONSTRAINT subscription_cycle_pkey PRIMARY KEY (cycle_id);


--
-- Name: subscription_delivery_schedule subscription_delivery_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_delivery_schedule
    ADD CONSTRAINT subscription_delivery_schedule_pkey PRIMARY KEY (schedule_id);


--
-- Name: subscription_plan subscription_plan_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_plan
    ADD CONSTRAINT subscription_plan_pkey PRIMARY KEY (subscription_plan_id);


--
-- Name: subscription_plan_product subscription_plan_product_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_plan_product
    ADD CONSTRAINT subscription_plan_product_pkey PRIMARY KEY (spp_id);


--
-- Name: user_vehicle user_vehicle_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_vehicle
    ADD CONSTRAINT user_vehicle_pkey PRIMARY KEY (user_vehicle_id);


--
-- Name: vehicle_inventory vehicle_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicle_inventory
    ADD CONSTRAINT vehicle_inventory_pkey PRIMARY KEY (vehicle_id, product_id);


--
-- Name: vehicle vehicle_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicle
    ADD CONSTRAINT vehicle_pkey PRIMARY KEY (vehicle_id);


--
-- Name: vehicle_route_inventory vehicle_route_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicle_route_inventory
    ADD CONSTRAINT vehicle_route_inventory_pkey PRIMARY KEY (inventory_id);


--
-- Name: vehicle_zone vehicle_zone_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicle_zone
    ADD CONSTRAINT vehicle_zone_pkey PRIMARY KEY (vehicle_zone_id);


--
-- Name: warehouse warehouse_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouse
    ADD CONSTRAINT warehouse_pkey PRIMARY KEY (warehouse_id);


--
-- Name: zone zone_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zone
    ADD CONSTRAINT zone_pkey PRIMARY KEY (zone_id);


--
-- Name: RefreshToken_token_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "RefreshToken_token_key" ON public."RefreshToken" USING btree (token);


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_recoveryToken_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "User_recoveryToken_key" ON public."User" USING btree ("recoveryToken");


--
-- Name: country_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX country_code_key ON public.country USING btree (code);


--
-- Name: customer_subscription_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX customer_subscription_status_idx ON public.customer_subscription USING btree (status);


--
-- Name: movement_type_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX movement_type_code_key ON public.movement_type USING btree (code);


--
-- Name: order_header_order_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX order_header_order_date_idx ON public.order_header USING btree (order_date);


--
-- Name: order_header_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX order_header_status_idx ON public.order_header USING btree (status);


--
-- Name: payment_method_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX payment_method_code_key ON public.payment_method USING btree (code);


--
-- Name: person_alias_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX person_alias_idx ON public.person USING btree (alias);


--
-- Name: person_name_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX person_name_idx ON public.person USING btree (name);


--
-- Name: person_phone_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX person_phone_key ON public.person USING btree (phone);


--
-- Name: person_tax_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX person_tax_id_idx ON public.person USING btree (tax_id);


--
-- Name: price_list_history_change_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX price_list_history_change_date_idx ON public.price_list_history USING btree (change_date);


--
-- Name: price_list_history_price_list_item_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX price_list_history_price_list_item_id_idx ON public.price_list_history USING btree (price_list_item_id);


--
-- Name: province_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX province_code_key ON public.province USING btree (code);


--
-- Name: sale_channel_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX sale_channel_code_key ON public.sale_channel USING btree (code);


--
-- Name: user_vehicle_is_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_vehicle_is_active_idx ON public.user_vehicle USING btree (is_active);


--
-- Name: user_vehicle_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_vehicle_user_id_idx ON public.user_vehicle USING btree (user_id);


--
-- Name: user_vehicle_user_id_vehicle_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX user_vehicle_user_id_vehicle_id_key ON public.user_vehicle USING btree (user_id, vehicle_id);


--
-- Name: user_vehicle_vehicle_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_vehicle_vehicle_id_idx ON public.user_vehicle USING btree (vehicle_id);


--
-- Name: vehicle_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX vehicle_code_key ON public.vehicle USING btree (code);


--
-- Name: vehicle_zone_is_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX vehicle_zone_is_active_idx ON public.vehicle_zone USING btree (is_active);


--
-- Name: vehicle_zone_vehicle_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX vehicle_zone_vehicle_id_idx ON public.vehicle_zone USING btree (vehicle_id);


--
-- Name: vehicle_zone_vehicle_id_zone_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX vehicle_zone_vehicle_id_zone_id_key ON public.vehicle_zone USING btree (vehicle_id, zone_id);


--
-- Name: vehicle_zone_zone_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX vehicle_zone_zone_id_idx ON public.vehicle_zone USING btree (zone_id);


--
-- Name: zone_locality_id_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX zone_locality_id_code_key ON public.zone USING btree (locality_id, code);


--
-- Name: zone_locality_id_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX zone_locality_id_name_key ON public.zone USING btree (locality_id, name);


--
-- Name: RefreshToken RefreshToken_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."RefreshToken"
    ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: delivery_evidence delivery_evidence_route_sheet_detail_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_evidence
    ADD CONSTRAINT delivery_evidence_route_sheet_detail_id_fkey FOREIGN KEY (route_sheet_detail_id) REFERENCES public.route_sheet_detail(route_sheet_detail_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: delivery_incident delivery_incident_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_incident
    ADD CONSTRAINT delivery_incident_created_by_fkey FOREIGN KEY (created_by) REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: delivery_incident delivery_incident_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_incident
    ADD CONSTRAINT delivery_incident_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: delivery_incident delivery_incident_route_sheet_detail_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_incident
    ADD CONSTRAINT delivery_incident_route_sheet_detail_id_fkey FOREIGN KEY (route_sheet_detail_id) REFERENCES public.route_sheet_detail(route_sheet_detail_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: delivery_stats delivery_stats_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_stats
    ADD CONSTRAINT delivery_stats_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: delivery_stats delivery_stats_route_sheet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_stats
    ADD CONSTRAINT delivery_stats_route_sheet_id_fkey FOREIGN KEY (route_sheet_id) REFERENCES public.route_sheet(route_sheet_id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: delivery_stats delivery_stats_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_stats
    ADD CONSTRAINT delivery_stats_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicle(vehicle_id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: delivery_stats delivery_stats_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_stats
    ADD CONSTRAINT delivery_stats_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zone(zone_id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: client_contract fk_contract_person; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_contract
    ADD CONSTRAINT fk_contract_person FOREIGN KEY (person_id) REFERENCES public.person(person_id);


--
-- Name: client_contract fk_contract_pricelist; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_contract
    ADD CONSTRAINT fk_contract_pricelist FOREIGN KEY (price_list_id) REFERENCES public.price_list(price_list_id);


--
-- Name: customer_subscription fk_cust_sub_plan; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_subscription
    ADD CONSTRAINT fk_cust_sub_plan FOREIGN KEY (subscription_plan_id) REFERENCES public.subscription_plan(subscription_plan_id);


--
-- Name: customer_subscription fk_customer_subscription_person; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_subscription
    ADD CONSTRAINT fk_customer_subscription_person FOREIGN KEY (customer_id) REFERENCES public.person(person_id);


--
-- Name: subscription_cycle_detail fk_cycle_detail_cycle; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_cycle_detail
    ADD CONSTRAINT fk_cycle_detail_cycle FOREIGN KEY (cycle_id) REFERENCES public.subscription_cycle(cycle_id);


--
-- Name: subscription_cycle_detail fk_cycle_detail_product; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_cycle_detail
    ADD CONSTRAINT fk_cycle_detail_product FOREIGN KEY (product_id) REFERENCES public.product(product_id);


--
-- Name: subscription_cycle fk_cycle_subscription; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_cycle
    ADD CONSTRAINT fk_cycle_subscription FOREIGN KEY (subscription_id) REFERENCES public.customer_subscription(subscription_id);


--
-- Name: installment_order_link fk_installment_order_installment; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.installment_order_link
    ADD CONSTRAINT fk_installment_order_installment FOREIGN KEY (installment_id) REFERENCES public.payment_installment(installment_id);


--
-- Name: installment_order_link fk_installment_order_order; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.installment_order_link
    ADD CONSTRAINT fk_installment_order_order FOREIGN KEY (order_id) REFERENCES public.order_header(order_id);


--
-- Name: inventory fk_inventory_product; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT fk_inventory_product FOREIGN KEY (product_id) REFERENCES public.product(product_id);


--
-- Name: locality fk_locality_province; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.locality
    ADD CONSTRAINT fk_locality_province FOREIGN KEY (province_id) REFERENCES public.province(province_id);


--
-- Name: order_header fk_order_contract; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_header
    ADD CONSTRAINT fk_order_contract FOREIGN KEY (contract_id) REFERENCES public.client_contract(contract_id);


--
-- Name: order_item fk_orderitem_order; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_item
    ADD CONSTRAINT fk_orderitem_order FOREIGN KEY (order_id) REFERENCES public.order_header(order_id);


--
-- Name: order_item fk_orderitem_product; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_item
    ADD CONSTRAINT fk_orderitem_product FOREIGN KEY (product_id) REFERENCES public.product(product_id);


--
-- Name: payment_line fk_payment_line_product; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_line
    ADD CONSTRAINT fk_payment_line_product FOREIGN KEY (product_id) REFERENCES public.product(product_id);


--
-- Name: payment_line fk_payment_line_transaction; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_line
    ADD CONSTRAINT fk_payment_line_transaction FOREIGN KEY (transaction_id) REFERENCES public.payment_transaction(transaction_id);


--
-- Name: payment_transaction fk_payment_order; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_transaction
    ADD CONSTRAINT fk_payment_order FOREIGN KEY (order_id) REFERENCES public.order_header(order_id);


--
-- Name: price_list_item fk_pricelistitem_pricelist; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.price_list_item
    ADD CONSTRAINT fk_pricelistitem_pricelist FOREIGN KEY (price_list_id) REFERENCES public.price_list(price_list_id);


--
-- Name: price_list_item fk_pricelistitem_product; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.price_list_item
    ADD CONSTRAINT fk_pricelistitem_product FOREIGN KEY (product_id) REFERENCES public.product(product_id);


--
-- Name: product fk_product_category; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT fk_product_category FOREIGN KEY (category_id) REFERENCES public.product_category(category_id);


--
-- Name: province fk_province_country; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.province
    ADD CONSTRAINT fk_province_country FOREIGN KEY (country_id) REFERENCES public.country(country_id);


--
-- Name: route_sheet_detail fk_route_detail_order; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.route_sheet_detail
    ADD CONSTRAINT fk_route_detail_order FOREIGN KEY (order_id) REFERENCES public.order_header(order_id);


--
-- Name: route_sheet_detail fk_route_detail_route; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.route_sheet_detail
    ADD CONSTRAINT fk_route_detail_route FOREIGN KEY (route_sheet_id) REFERENCES public.route_sheet(route_sheet_id);


--
-- Name: route_sheet fk_route_driver; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.route_sheet
    ADD CONSTRAINT fk_route_driver FOREIGN KEY (driver_id) REFERENCES public."User"(id);


--
-- Name: route_sheet fk_route_vehicle; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.route_sheet
    ADD CONSTRAINT fk_route_vehicle FOREIGN KEY (vehicle_id) REFERENCES public.vehicle(vehicle_id);


--
-- Name: contract_delivery_schedule fk_schedule_contract; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_delivery_schedule
    ADD CONSTRAINT fk_schedule_contract FOREIGN KEY (contract_id) REFERENCES public.client_contract(contract_id);


--
-- Name: subscription_plan_product fk_spp_plan; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_plan_product
    ADD CONSTRAINT fk_spp_plan FOREIGN KEY (subscription_plan_id) REFERENCES public.subscription_plan(subscription_plan_id);


--
-- Name: subscription_plan_product fk_spp_product; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_plan_product
    ADD CONSTRAINT fk_spp_product FOREIGN KEY (product_id) REFERENCES public.product(product_id);


--
-- Name: stock_movement fk_stockmovement_movement_type; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movement
    ADD CONSTRAINT fk_stockmovement_movement_type FOREIGN KEY (movement_type_id) REFERENCES public.movement_type(movement_type_id);


--
-- Name: stock_movement fk_stockmovement_product; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movement
    ADD CONSTRAINT fk_stockmovement_product FOREIGN KEY (product_id) REFERENCES public.product(product_id);


--
-- Name: subscription_delivery_schedule fk_sub_schedule_subscription; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_delivery_schedule
    ADD CONSTRAINT fk_sub_schedule_subscription FOREIGN KEY (subscription_id) REFERENCES public.customer_subscription(subscription_id);


--
-- Name: user_vehicle fk_user_vehicle_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_vehicle
    ADD CONSTRAINT fk_user_vehicle_user FOREIGN KEY (user_id) REFERENCES public."User"(id) ON DELETE CASCADE;


--
-- Name: user_vehicle fk_user_vehicle_vehicle; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_vehicle
    ADD CONSTRAINT fk_user_vehicle_vehicle FOREIGN KEY (vehicle_id) REFERENCES public.vehicle(vehicle_id) ON DELETE CASCADE;


--
-- Name: vehicle_zone fk_vehicle_zone_vehicle; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicle_zone
    ADD CONSTRAINT fk_vehicle_zone_vehicle FOREIGN KEY (vehicle_id) REFERENCES public.vehicle(vehicle_id) ON DELETE CASCADE;


--
-- Name: vehicle_zone fk_vehicle_zone_zone; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicle_zone
    ADD CONSTRAINT fk_vehicle_zone_zone FOREIGN KEY (zone_id) REFERENCES public.zone(zone_id) ON DELETE CASCADE;


--
-- Name: vehicle_inventory fk_vehicleinventory_product; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicle_inventory
    ADD CONSTRAINT fk_vehicleinventory_product FOREIGN KEY (product_id) REFERENCES public.product(product_id);


--
-- Name: vehicle_inventory fk_vehicleinventory_vehicle; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicle_inventory
    ADD CONSTRAINT fk_vehicleinventory_vehicle FOREIGN KEY (vehicle_id) REFERENCES public.vehicle(vehicle_id);


--
-- Name: warehouse fk_warehouse_locality; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouse
    ADD CONSTRAINT fk_warehouse_locality FOREIGN KEY (locality_id) REFERENCES public.locality(locality_id);


--
-- Name: zone fk_zone_locality; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zone
    ADD CONSTRAINT fk_zone_locality FOREIGN KEY (locality_id) REFERENCES public.locality(locality_id);


--
-- Name: installment_order_link installment_order_link_order_itemOrder_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.installment_order_link
    ADD CONSTRAINT "installment_order_link_order_itemOrder_item_id_fkey" FOREIGN KEY ("order_itemOrder_item_id") REFERENCES public.order_item(order_item_id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_transaction inventory_transaction_detail_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_transaction
    ADD CONSTRAINT inventory_transaction_detail_id_fkey FOREIGN KEY (detail_id) REFERENCES public.route_sheet_detail(route_sheet_detail_id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_transaction inventory_transaction_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_transaction
    ADD CONSTRAINT inventory_transaction_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.product(product_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_transaction inventory_transaction_route_sheet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_transaction
    ADD CONSTRAINT inventory_transaction_route_sheet_id_fkey FOREIGN KEY (route_sheet_id) REFERENCES public.route_sheet(route_sheet_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: one_off_purchase one_off_purchase_locality_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.one_off_purchase
    ADD CONSTRAINT one_off_purchase_locality_id_fkey FOREIGN KEY (locality_id) REFERENCES public.locality(locality_id);


--
-- Name: one_off_purchase one_off_purchase_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.one_off_purchase
    ADD CONSTRAINT one_off_purchase_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.person(person_id);


--
-- Name: one_off_purchase one_off_purchase_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.one_off_purchase
    ADD CONSTRAINT one_off_purchase_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.product(product_id);


--
-- Name: one_off_purchase one_off_purchase_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.one_off_purchase
    ADD CONSTRAINT one_off_purchase_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zone(zone_id);


--
-- Name: order_header order_header_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_header
    ADD CONSTRAINT order_header_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.person(person_id);


--
-- Name: order_header order_header_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_header
    ADD CONSTRAINT order_header_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.customer_subscription(subscription_id);


--
-- Name: payment_installment payment_installment_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_installment
    ADD CONSTRAINT payment_installment_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.person(person_id);


--
-- Name: payment_transaction payment_transaction_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_transaction
    ADD CONSTRAINT payment_transaction_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: person person_locality_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person
    ADD CONSTRAINT person_locality_id_fkey FOREIGN KEY (locality_id) REFERENCES public.locality(locality_id);


--
-- Name: person person_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person
    ADD CONSTRAINT person_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zone(zone_id);


--
-- Name: price_list_history price_list_history_price_list_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.price_list_history
    ADD CONSTRAINT price_list_history_price_list_item_id_fkey FOREIGN KEY (price_list_item_id) REFERENCES public.price_list_item(price_list_item_id) ON DELETE CASCADE;


--
-- Name: route_optimization route_optimization_route_sheet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.route_optimization
    ADD CONSTRAINT route_optimization_route_sheet_id_fkey FOREIGN KEY (route_sheet_id) REFERENCES public.route_sheet(route_sheet_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: stock_movement stock_movement_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movement
    ADD CONSTRAINT stock_movement_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.order_header(order_id);


--
-- Name: stock_movement stock_movement_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movement
    ADD CONSTRAINT stock_movement_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."User"(id);


--
-- Name: vehicle_route_inventory vehicle_route_inventory_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicle_route_inventory
    ADD CONSTRAINT vehicle_route_inventory_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.product(product_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: vehicle_route_inventory vehicle_route_inventory_route_sheet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicle_route_inventory
    ADD CONSTRAINT vehicle_route_inventory_route_sheet_id_fkey FOREIGN KEY (route_sheet_id) REFERENCES public.route_sheet(route_sheet_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--


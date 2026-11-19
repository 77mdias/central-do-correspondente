-- migrate:up
-- Tabelas do Better Auth 1.7.16 (e-mail e senha, rateLimit no banco, id uuid), iguais às do AtelieSys,
-- mais os campos extras do usuário (input: false; só o nosso código grava, como app_system).
create table "user" ("id" uuid default pg_catalog.gen_random_uuid() not null primary key, "name" text not null, "email" text not null unique, "emailVerified" boolean not null, "image" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null,
  "termosVersao" text, "termosAceitosEm" timestamptz, "adminSistema" boolean default false not null);

create table "session" ("id" uuid default pg_catalog.gen_random_uuid() not null primary key, "expiresAt" timestamptz not null, "token" text not null unique, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null, "ipAddress" text, "userAgent" text, "userId" uuid not null references "user" ("id") on delete cascade);

create table "account" ("id" uuid default pg_catalog.gen_random_uuid() not null primary key, "accountId" text not null, "providerId" text not null, "userId" uuid not null references "user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" timestamptz, "refreshTokenExpiresAt" timestamptz, "scope" text, "password" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null);

create table "verification" ("id" uuid default pg_catalog.gen_random_uuid() not null primary key, "identifier" text not null, "value" text not null, "expiresAt" timestamptz not null, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);

create table "rateLimit" ("id" uuid default pg_catalog.gen_random_uuid() not null primary key, "key" text not null unique, "count" integer not null, "lastRequest" bigint not null);

create index "session_userId_idx" on "session" ("userId");
create index "account_userId_idx" on "account" ("userId");
create index "verification_identifier_idx" on "verification" ("identifier");

-- Acesso: só app_system (o próprio Better Auth e o código de sistema). app_user não recebe grant nestas tabelas.
revoke all on schema public from public;
grant usage on schema public to app_user, app_system;
grant select, insert, update, delete on all tables in schema public to app_system;
alter default privileges in schema public grant select, insert, update, delete on tables to app_system;
alter default privileges in schema public grant usage, select on sequences to app_system;

-- RLS ligada sem policy: quem não tem BYPASSRLS não vê nada.
alter table "user" enable row level security;
alter table "session" enable row level security;
alter table "account" enable row level security;
alter table "verification" enable row level security;
alter table "rateLimit" enable row level security;

-- migrate:down
alter default privileges in schema public revoke usage, select on sequences from app_system;
alter default privileges in schema public revoke select, insert, update, delete on tables from app_system;
drop table "rateLimit";
drop table "verification";
drop table "account";
drop table "session";
drop table "user";

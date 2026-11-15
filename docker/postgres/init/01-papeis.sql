-- Papéis de aplicação (valem para o cluster inteiro, por isso fora das migrations) e bancos de teste.
-- Senhas de desenvolvimento. Em produção, o operador cria os papéis com senhas fortes (docs/SEGREDOS.md).
create role app_user login password 'app_user' nobypassrls;
create role app_system login password 'app_system' bypassrls;
create database cc_test;
create database cc_e2e;

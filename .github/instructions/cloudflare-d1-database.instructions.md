---
applyTo: '**'
---

---
title: Getting started · Cloudflare D1 docs
description: This guide instructs you through:
lastUpdated: 2025-05-06T09:42:37.000Z
source_url:
  html: https://developers.cloudflare.com/d1/get-started/
  md: https://developers.cloudflare.com/d1/get-started/index.md
---

This guide instructs you through:

* Creating your first database using D1, Cloudflare's native serverless SQL database.
* Creating a schema and querying your database via the command-line.
* Connecting a [Cloudflare Worker](https://developers.cloudflare.com/workers/) to your D1 database using bindings, and querying your D1 database programmatically.

You can perform these tasks through the CLI or through the Cloudflare dashboard.

Note

If you already have an existing Worker and an existing D1 database, follow this tutorial from [3. Bind your Worker to your D1 database](https://developers.cloudflare.com/d1/get-started/#3-bind-your-worker-to-your-d1-database).

## Quick start

If you want to skip the steps and get started quickly, click on the button below.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/docs-examples/tree/d1-get-started/d1/d1-get-started)

This creates a repository in your GitHub account and deploys the application to Cloudflare Workers. Use this option if you are familiar with Cloudflare Workers, and wish to skip the step-by-step guidance.

You may wish to manually follow the steps if you are new to Cloudflare Workers.

## Prerequisites

1. Sign up for a [Cloudflare account](https://dash.cloudflare.com/sign-up/workers-and-pages).
2. Install [`Node.js`](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm).

Node.js version manager

Use a Node version manager like [Volta](https://volta.sh/) or [nvm](https://github.com/nvm-sh/nvm) to avoid permission issues and change Node.js versions. [Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/), discussed later in this guide, requires a Node version of `16.17.0` or later.

## 1. Create a Worker

Create a new Worker as the means to query your database.

* CLI

  1. Create a new project named `d1-tutorial` by running:

     * npm

       ```sh
       npm create cloudflare@latest -- d1-tutorial
       ```

     * yarn

       ```sh
       yarn create cloudflare d1-tutorial
       ```

     * pnpm

       ```sh
       pnpm create cloudflare@latest d1-tutorial
       ```

     For setup, select the following options:

     * For *What would you like to start with?*, choose `Hello World Starter`.
     * For *Which template would you like to use?*, choose `Worker only`.
     * For *Which language do you want to use?*, choose `TypeScript`.
     * For *Do you want to use git for version control?*, choose `Yes`.
     * For *Do you want to deploy your application?*, choose `No` (we will be making some changes before deploying).

     This creates a new `d1-tutorial` directory as illustrated below.

     Your new `d1-tutorial` directory includes:

     * A `"Hello World"` [Worker](https://developers.cloudflare.com/workers/get-started/guide/#3-write-code) in `index.ts`.
     * A [Wrangler configuration file](https://developers.cloudflare.com/workers/wrangler/configuration/). This file is how your `d1-tutorial` Worker accesses your D1 database.

  Note

  If you are familiar with Cloudflare Workers, or initializing projects in a Continuous Integration (CI) environment, initialize a new project non-interactively by setting `CI=true` as an [environmental variable](https://developers.cloudflare.com/workers/configuration/environment-variables/) when running `create cloudflare@latest`.

  For example: `CI=true npm create cloudflare@latest d1-tutorial --type=simple --git --ts --deploy=false` creates a basic "Hello World" project ready to build on.

* Dashboard

  1. Log in to your [Cloudflare dashboard](https://dash.cloudflare.com/) and select your account.
  2. Go to your account > **Compute (Workers)** > **Workers & Pages**.
  3. Select **Create**.
  4. Under **Start from a template**, select **Hello world**.
  5. Name your Worker. For this tutorial, name your Worker `d1-tutorial`.
  6. Select **Deploy**.

* npm

  ```sh
  npm create cloudflare@latest -- d1-tutorial
  ```

* yarn

  ```sh
  yarn create cloudflare d1-tutorial
  ```

* pnpm

  ```sh
  pnpm create cloudflare@latest d1-tutorial
  ```

## 2. Create a database

A D1 database is conceptually similar to many other SQL databases: a database may contain one or more tables, the ability to query those tables, and optional indexes. D1 uses the familiar [SQL query language](https://www.sqlite.org/lang.html) (as used by SQLite).

To create your first D1 database:

* CLI

  1. Change into the directory you just created for your Workers project:

     ```sh
     cd d1-tutorial
     ```

  2. Run the following `wrangler@latest d1` command and give your database a name. In this tutorial, the database is named `prod-d1-tutorial`:

     Note

     The [Wrangler command-line interface](https://developers.cloudflare.com/workers/wrangler/) is Cloudflare's tool for managing and deploying Workers applications and D1 databases in your terminal. It was installed when you used `npm create cloudflare@latest` to initialize your new project.

     While Wrangler gets installed locally to your project, you can use it outside the project by using the command `npx wrangler`.

     ```sh
     npx wrangler@latest d1 create prod-d1-tutorial
     ```

     ```sh
        ✅ Successfully created DB 'prod-d1-tutorial' in region WEUR
        Created your new D1 database.


        {
          "d1_databases": [
            {
              "binding": "DB",
              "database_name": "prod-d1-tutorial",
              "database_id": "<unique-ID-for-your-database>"
            }
          ]
        }
     ```

  This creates a new D1 database and outputs the [binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/) configuration needed in the next step.

* Dashboard

  1. Go to **Storage & Databases** > **D1 SQL Database**.
  2. Select **Create Database**.
  3. Name your database. For this tutorial, name your D1 database `prod-d1-tutorial`.
  4. (Optional) Provide a location hint. Location hint is an optional parameter you can provide to indicate your desired geographical location for your database. Refer to [Provide a location hint](https://developers.cloudflare.com/d1/configuration/data-location/#provide-a-location-hint) for more information.
  5. Select **Create**.

Note

For reference, a good database name:

* Uses a combination of ASCII characters, shorter than 32 characters, and uses dashes (-) instead of spaces.
* Is descriptive of the use-case and environment. For example, "staging-db-web" or "production-db-backend".
* Only describes the database, and is not directly referenced in code.

## 3. Bind your Worker to your D1 database

You must create a binding for your Worker to connect to your D1 database. [Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/) allow your Workers to access resources, like D1, on the Cloudflare developer platform.

To bind your D1 database to your Worker:

* CLI

  You create bindings by updating your Wrangler file.

  1. Copy the lines obtained from [step 2](https://developers.cloudflare.com/d1/get-started/#2-create-a-database) from your terminal.

  2. Add them to the end of your Wrangler file.

     * wrangler.jsonc

       ```jsonc
       {
         "d1_databases": [
           {
             "binding": "DB",
             "database_name": "prod-d1-tutorial",
             "database_id": "<unique-ID-for-your-database>"
           }
         ]
       }
       ```

     * wrangler.toml

       ```toml
       [[d1_databases]]
       binding = "DB" # available in your Worker on env.DB
       database_name = "prod-d1-tutorial"
       database_id = "<unique-ID-for-your-database>"
       ```

     Specifically:

     * The value (string) you set for `binding` is the **binding name**, and is used to reference this database in your Worker. In this tutorial, name your binding `DB`.
     * The binding name must be [a valid JavaScript variable name](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Grammar_and_types#variables). For example, `binding = "MY_DB"` or `binding = "productionDB"` would both be valid names for the binding.
     * Your binding is available in your Worker at `env.<BINDING_NAME>` and the D1 [Workers Binding API](https://developers.cloudflare.com/d1/worker-api/) is exposed on this binding.

  Note

  When you execute the `wrangler d1 create` command, the client API package (which implements the D1 API and database class) is automatically installed. For more information on the D1 Workers Binding API, refer to [Workers Binding API](https://developers.cloudflare.com/d1/worker-api/).

  You can also bind your D1 database to a [Pages Function](https://developers.cloudflare.com/pages/functions/). For more information, refer to [Functions Bindings for D1](https://developers.cloudflare.com/pages/functions/bindings/#d1-databases).

* Dashboard

  You create bindings by adding them to the Worker you have created.

  1. Go to **Compute (Workers)** > **Workers & Pages**.

  2. Select the `d1-tutorial` Worker you created in [step 1](https://developers.cloudflare.com/d1/get-started/#1-create-a-worker).

  3. Select **Settings**.

  4. Scroll to **Bindings**, then select **Add**.

  5. Select **D1 database**.

  6. Name your binding in **Variable name**, then select the `prod-d1-tutorial` D1 database you created in [step 2](https://developers.cloudflare.com/d1/get-started/#2-create-a-database) from the dropdown menu. For this tutorial, name your binding `DB`.

  7. Select **Deploy** to deploy your binding. When deploying, there are two options:

     * **Deploy:** Immediately deploy the binding to 100% of your audience.
     * **Save version:** Save a version of the binding which you can deploy in the future.

     For this tutorial, select **Deploy**.

* wrangler.jsonc

  ```jsonc
  {
    "d1_databases": [
      {
        "binding": "DB",
        "database_name": "prod-d1-tutorial",
        "database_id": "<unique-ID-for-your-database>"
      }
    ]
  }
  ```

* wrangler.toml

  ```toml
  [[d1_databases]]
  binding = "DB" # available in your Worker on env.DB
  database_name = "prod-d1-tutorial"
  database_id = "<unique-ID-for-your-database>"
  ```

## 4. Run a query against your D1 database

### Populate your D1 database

* CLI

  After correctly preparing your [Wrangler configuration file](https://developers.cloudflare.com/workers/wrangler/configuration/), set up your database. Create a `schema.sql` file using the SQL syntax below to initialize your database.

  1. Copy the following code and save it as a `schema.sql` file in the `d1-tutorial` Worker directory you created in step 1:

     ```sql
     DROP TABLE IF EXISTS Customers;
     CREATE TABLE IF NOT EXISTS Customers (CustomerId INTEGER PRIMARY KEY, CompanyName TEXT, ContactName TEXT);
     INSERT INTO Customers (CustomerID, CompanyName, ContactName) VALUES (1, 'Alfreds Futterkiste', 'Maria Anders'), (4, 'Around the Horn', 'Thomas Hardy'), (11, 'Bs Beverages', 'Victoria Ashworth'), (13, 'Bs Beverages', 'Random Name');
     ```

  2. Initialize your database to run and test locally first. Bootstrap your new D1 database by running:

     ```sh
     npx wrangler d1 execute prod-d1-tutorial --local --file=./schema.sql
     ```

     ```output
      ⛅️ wrangler 4.13.2
     -------------------


     🌀 Executing on local database prod-d1-tutorial (<DATABASE_ID>) from .wrangler/state/v3/d1:
     🌀 To execute on your remote database, add a --remote flag to your wrangler command.
     🚣 3 commands executed successfully.
     ```

     Note

     The command `npx wrangler d1 execute` initializes your database locally, not on the remote database.

  3. Validate that your data is in the database by running:

     ```sh
     npx wrangler d1 execute prod-d1-tutorial --local --command="SELECT * FROM Customers"
     ```

     ```sh
     🌀 Mapping SQL input into an array of statements
     🌀 Executing on local database production-db-backend (<DATABASE_ID>) from .wrangler/state/v3/d1:
     ┌────────────┬─────────────────────┬───────────────────┐
     │ CustomerId │ CompanyName         │ ContactName       │
     ├────────────┼─────────────────────┼───────────────────┤
     │ 1          │ Alfreds Futterkiste │ Maria Anders      │
     ├────────────┼─────────────────────┼───────────────────┤
     │ 4          │ Around the Horn     │ Thomas Hardy      │
     ├────────────┼─────────────────────┼───────────────────┤
     │ 11         │ Bs Beverages        │ Victoria Ashworth │
     ├────────────┼─────────────────────┼───────────────────┤
     │ 13         │ Bs Beverages        │ Random Name       │
     └────────────┴─────────────────────┴───────────────────┘
     ```

* Dashboard

  Use the Dashboard to create a table and populate it with data.

  1. Go to **Storage & Databases** > **D1 SQL Database**.

  2. Select the `prod-d1-tutorial` database you created in [step 2](https://developers.cloudflare.com/d1/get-started/#2-create-a-database).

  3. Select **Console**.

  4. Paste the following SQL snippet.

     ```sql
     DROP TABLE IF EXISTS Customers;
     CREATE TABLE IF NOT EXISTS Customers (CustomerId INTEGER PRIMARY KEY, CompanyName TEXT, ContactName TEXT);
     INSERT INTO Customers (CustomerID, CompanyName, ContactName) VALUES (1, 'Alfreds Futterkiste', 'Maria Anders'), (4, 'Around the Horn', 'Thomas Hardy'), (11, 'Bs Beverages', 'Victoria Ashworth'), (13, 'Bs Beverages', 'Random Name');
     ```

  5. Select **Execute**. This creates a table called `Customers` in your `prod-d1-tutorial` database.

  6. Select **Tables**, then select the `Customers` table to view the contents of the table.

### Write queries within your Worker

After you have set up your database, run an SQL query from within your Worker.

* CLI

  1. Navigate to your `d1-tutorial` Worker and open the `index.ts` file. The `index.ts` file is where you configure your Worker's interactions with D1.

  2. Clear the content of `index.ts`.

  3. Paste the following code snippet into your `index.ts` file:

     * JavaScript

       ```js
       export default {
         async fetch(request, env) {
           const { pathname } = new URL(request.url);


           if (pathname === "/api/beverages") {
             // If you did not use `DB` as your binding name, change it here
             const { results } = await env.DB.prepare(
               "SELECT * FROM Customers WHERE CompanyName = ?",
             )
               .bind("Bs Beverages")
               .all();
             return Response.json(results);
           }


           return new Response(
             "Call /api/beverages to see everyone who works at Bs Beverages",
           );
         },
       };
       ```

     * TypeScript

       ```ts
       export interface Env {
         // If you set another name in the Wrangler config file for the value for 'binding',
         // replace "DB" with the variable name you defined.
         DB: D1Database;
       }


       export default {
         async fetch(request, env): Promise<Response> {
           const { pathname } = new URL(request.url);


           if (pathname === "/api/beverages") {
             // If you did not use `DB` as your binding name, change it here
             const { results } = await env.DB.prepare(
               "SELECT * FROM Customers WHERE CompanyName = ?",
             )
               .bind("Bs Beverages")
               .all();
             return Response.json(results);
           }


           return new Response(
             "Call /api/beverages to see everyone who works at Bs Beverages",
           );
         },
       } satisfies ExportedHandler<Env>;
       ```

     In the code above, you:

     1. Define a binding to your D1 database in your code. This binding matches the `binding` value you set in the [Wrangler configuration file](https://developers.cloudflare.com/workers/wrangler/configuration/) under `d1_databases`.
     2. Query your database using `env.DB.prepare` to issue a [prepared query](https://developers.cloudflare.com/d1/worker-api/d1-database/#prepare) with a placeholder (the `?` in the query).
     3. Call `bind()` to safely and securely bind a value to that placeholder. In a real application, you would allow a user to pass the `CompanyName` they want to list results for. Using `bind()` prevents users from executing arbitrary SQL (known as "SQL injection") against your application and deleting or otherwise modifying your database.
     4. Execute the query by calling `all()` to return all rows (or none, if the query returns none).
     5. Return your query results, if any, in JSON format with `Response.json(results)`.

  After configuring your Worker, you can test your project locally before you deploy globally.

* Dashboard

  You can query your D1 database using your Worker.

  1. Go to **Compute (Workers)** > **Workers & Pages**.

  2. Select the `d1-tutorial` Worker you created.

  3. Select the **Edit code** icon (**\</>**).

  4. Clear the contents of the `worker.js` file, then paste the following code:

     ```js
     export default {
       async fetch(request, env) {
         const { pathname } = new URL(request.url);


         if (pathname === "/api/beverages") {
           // If you did not use `DB` as your binding name, change it here
           const { results } = await env.DB.prepare(
             "SELECT * FROM Customers WHERE CompanyName = ?"
           )
             .bind("Bs Beverages")
             .all();
           return new Response(JSON.stringify(results), {
             headers: { 'Content-Type': 'application/json' }
           });
         }


         return new Response(
           "Call /api/beverages to see everyone who works at Bs Beverages"
         );
       },
     };
     ```

  5. Select **Save**.

* JavaScript

  ```js
  export default {
    async fetch(request, env) {
      const { pathname } = new URL(request.url);


      if (pathname === "/api/beverages") {
        // If you did not use `DB` as your binding name, change it here
        const { results } = await env.DB.prepare(
          "SELECT * FROM Customers WHERE CompanyName = ?",
        )
          .bind("Bs Beverages")
          .all();
        return Response.json(results);
      }


      return new Response(
        "Call /api/beverages to see everyone who works at Bs Beverages",
      );
    },
  };
  ```

* TypeScript

  ```ts
  export interface Env {
    // If you set another name in the Wrangler config file for the value for 'binding',
    // replace "DB" with the variable name you defined.
    DB: D1Database;
  }


  export default {
    async fetch(request, env): Promise<Response> {
      const { pathname } = new URL(request.url);


      if (pathname === "/api/beverages") {
        // If you did not use `DB` as your binding name, change it here
        const { results } = await env.DB.prepare(
          "SELECT * FROM Customers WHERE CompanyName = ?",
        )
          .bind("Bs Beverages")
          .all();
        return Response.json(results);
      }


      return new Response(
        "Call /api/beverages to see everyone who works at Bs Beverages",
      );
    },
  } satisfies ExportedHandler<Env>;
  ```

## 5. Deploy your application

Deploy your application on Cloudflare's global network.

* CLI

  To deploy your Worker to production using Wrangler, you must first repeat the [database configuration](https://developers.cloudflare.com/d1/get-started/#populate-your-d1-database) steps after replacing the `--local` flag with the `--remote` flag to give your Worker data to read. This creates the database tables and imports the data into the production version of your database.

  1. Create tables and add entries to your remote database with the `schema.sql` file you created in step 4. Enter `y` to confirm your decision.

     ```sh
     npx wrangler d1 execute prod-d1-tutorial --remote --file=./schema.sql
     ```

     ```sh
     ✔ ⚠️ This process may take some time, during which your D1 database will be unavailable to serve queries.
     Ok to proceed? y
     🚣 Executed 3 queries in 0.00 seconds (5 rows read, 6 rows written)
     Database is currently at bookmark 00000002-00000004-00004ef1-ad4a06967970ee3b20860c86188a4b31.
     ┌────────────────────────┬───────────┬──────────────┬────────────────────┐
     │ Total queries executed │ Rows read │ Rows written │ Database size (MB) │
     ├────────────────────────┼───────────┼──────────────┼────────────────────┤
     │ 3                      │ 5         │ 6            │ 0.02               │
     └────────────────────────┴───────────┴──────────────┴────────────────────┘
     ```

  2. Validate the data is in production by running:

     ```sh
     npx wrangler d1 execute prod-d1-tutorial --remote --command="SELECT * FROM Customers"
     ```

     ```sh
      ⛅️ wrangler 4.13.2
     -------------------


     🌀 Executing on remote database prod-d1-tutorial (<DATABASE_ID>):
     🌀 To execute on your local development database, remove the --remote flag from your wrangler command.
     🚣 Executed 1 command in 0.4069ms
     ┌────────────┬─────────────────────┬───────────────────┐
     │ CustomerId │ CompanyName         │ ContactName       │
     ├────────────┼─────────────────────┼───────────────────┤
     │ 1          │ Alfreds Futterkiste │ Maria Anders      │
     ├────────────┼─────────────────────┼───────────────────┤
     │ 4          │ Around the Horn     │ Thomas Hardy      │
     ├────────────┼─────────────────────┼───────────────────┤
     │ 11         │ Bs Beverages        │ Victoria Ashworth │
     ├────────────┼─────────────────────┼───────────────────┤
     │ 13         │ Bs Beverages        │ Random Name       │
     └────────────┴─────────────────────┴───────────────────┘
     ```

  3. Deploy your Worker to make your project accessible on the Internet. Run:

     ```sh
     npx wrangler deploy
     ```

     ```sh
      ⛅️ wrangler 4.13.2
      -------------------


      Total Upload: 0.19 KiB / gzip: 0.16 KiB
      Your worker has access to the following bindings:
      - D1 Databases:
        - DB: prod-d1-tutorial (<DATABASE_ID>)
      Uploaded d1-tutorial (3.76 sec)
      Deployed d1-tutorial triggers (2.77 sec)
        https://d1-tutorial.<YOUR_SUBDOMAIN>.workers.dev
      Current Version ID: <VERSION_ID>
     ```

     You can now visit the URL for your newly created project to query your live database.

     For example, if the URL of your new Worker is `d1-tutorial.<YOUR_SUBDOMAIN>.workers.dev`, accessing `https://d1-tutorial.<YOUR_SUBDOMAIN>.workers.dev/api/beverages` sends a request to your Worker that queries your live database directly.

  4. Test your database is running successfully. Add `/api/beverages` to the provided Wrangler URL. For example, `https://d1-tutorial.<YOUR_SUBDOMAIN>.workers.dev/api/beverages`.

* Dashboard

  1. Go to **Compute (Workers)** > **Workers & Pages**.
  2. Select your `d1-tutorial` Worker.
  3. Select **Deployments**.
  4. From the **Version History** table, select **Deploy version**.
  5. From the **Deploy version** page, select **Deploy**.

  This deploys the latest version of the Worker code to production.

## 6. (Optional) Develop locally with Wrangler

If you are using D1 with Wrangler, you can test your database locally. While in your project directory:

1. Run `wrangler dev`:

   ```sh
   npx wrangler dev
   ```

   When you run `wrangler dev`, Wrangler provides a URL (most likely `localhost:8787`) to review your Worker.

2. Go to the URL.

   The page displays `Call /api/beverages to see everyone who works at Bs Beverages`.

3. Test your database is running successfully. Add `/api/beverages` to the provided Wrangler URL. For example, `localhost:8787/api/beverages`.

If successful, the browser displays your data.

Note

You can only develop locally if you are using Wrangler. You cannot develop locally through the Cloudflare dashboard.

## 7. (Optional) Delete your database

To delete your database:

* CLI

  Run:

  ```sh
  npx wrangler d1 delete prod-d1-tutorial
  ```

* Dashboard

  1. Go to **Storages & Databases** > **D1 SQL Database**.

  2. Select your `prod-d1-tutorial` D1 database.

  3. Select **Settings**.

  4. Select **Delete**.

  5. Type the name of the database (`prod-d1-tutorial`) to confirm the deletion.

Warning

Note that deleting your D1 database will stop your application from functioning as before.

If you want to delete your Worker:

* CLI

  Run:

  ```sh
  npx wrangler delete d1-tutorial
  ```

* Dashboard

  1. Go to **Compute (Workers)** > **Workers & Pages**.

  2. Select your `d1-tutorial` Worker.

  3. Select **Settings**.

  4. Scroll to the bottom of the page, then select **Delete**.

  5. Type the name of the Worker (`d1-tutorial`) to confirm the deletion.

## Summary

In this tutorial, you have:

* Created a D1 database
* Created a Worker to access that database
* Deployed your project globally

## Next steps

If you have any feature requests or notice any bugs, share your feedback directly with the Cloudflare team by joining the [Cloudflare Developers community on Discord](https://discord.cloudflare.com).

* See supported [Wrangler commands for D1](https://developers.cloudflare.com/workers/wrangler/commands/#d1).
* Learn how to use [D1 Worker Binding APIs](https://developers.cloudflare.com/d1/worker-api/) within your Worker, and test them from the [API playground](https://developers.cloudflare.com/d1/worker-api/#api-playground).
* Explore [community projects built on D1](https://developers.cloudflare.com/d1/reference/community-projects/).


---
title: Import and export data · Cloudflare D1 docs
description: D1 allows you to import existing SQLite tables and their data directly, enabling you to migrate existing data into D1 quickly and easily. This can be useful when migrating applications to use Workers and D1, or when you want to prototype a schema locally before importing it to your D1 database(s).
lastUpdated: 2025-04-16T16:17:28.000Z
source_url:
  html: https://developers.cloudflare.com/d1/best-practices/import-export-data/
  md: https://developers.cloudflare.com/d1/best-practices/import-export-data/index.md
---

D1 allows you to import existing SQLite tables and their data directly, enabling you to migrate existing data into D1 quickly and easily. This can be useful when migrating applications to use Workers and D1, or when you want to prototype a schema locally before importing it to your D1 database(s).

D1 also allows you to export a database. This can be useful for [local development](https://developers.cloudflare.com/d1/best-practices/local-development/) or testing.

## Import an existing database

To import an existing SQLite database into D1, you must have:

1. The Cloudflare [Wrangler CLI installed](https://developers.cloudflare.com/workers/wrangler/install-and-update/).
2. A database to use as the target.
3. An existing SQLite (version 3.0+) database file to import.

Note

You cannot import a raw SQLite database (`.sqlite3` files) directly. Refer to [how to convert an existing SQLite file](#convert-sqlite-database-files) first.

For example, consider the following `users_export.sql` schema & values, which includes a `CREATE TABLE IF NOT EXISTS` statement:

```sql
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(50),
  full_name VARCHAR(50),
  created_on DATE
);
INSERT INTO users (id, full_name, created_on) VALUES ('01GREFXCN9519NRVXWTPG0V0BF', 'Catlaina Harbar', '2022-08-20 05:39:52');
INSERT INTO users (id, full_name, created_on) VALUES ('01GREFXCNBYBGX2GC6ZGY9FMP4', 'Hube Bilverstone', '2022-12-15 21:56:13');
INSERT INTO users (id, full_name, created_on) VALUES ('01GREFXCNCWAJWRQWC2863MYW4', 'Christin Moss', '2022-07-28 04:13:37');
INSERT INTO users (id, full_name, created_on) VALUES ('01GREFXCNDGQNBQAJG1AP0TYXZ', 'Vlad Koche', '2022-11-29 17:40:57');
INSERT INTO users (id, full_name, created_on) VALUES ('01GREFXCNF67KV7FPPSEJVJMEW', 'Riane Zamora', '2022-12-24 06:49:04');
```

With your `users_export.sql` file in the current working directory, you can pass the `--file=users_export.sql` flag to `d1 execute` to execute (import) our table schema and values:

```sh
npx wrangler d1 execute example-db --remote --file=users_export.sql
```

To confirm your table was imported correctly and is queryable, execute a `SELECT` statement to fetch all the tables from your D1 database:

```sh
npx wrangler d1 execute example-db --remote --command "SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name;"
```

```sh
...
🌀 To execute on your local development database, remove the --remote flag from your wrangler command.
🚣 Executed 1 commands in 0.3165ms
┌────────┐
│ name   │
├────────┤
│ _cf_KV │
├────────┤
│ users  │
└────────┘
```

Note

The `_cf_KV` table is a reserved table used by D1's underlying storage system. It cannot be queried and does not incur read/write operations charges against your account.

From here, you can now query our new table from our Worker [using the D1 Workers Binding API](https://developers.cloudflare.com/d1/worker-api/).

Known limitations

For imports, `wrangler d1 execute --file` is limited to 5GiB files, the same as the [R2 upload limit](https://developers.cloudflare.com/r2/platform/limits/). For imports larger than 5GiB, we recommend splitting the data into multiple files.

### Convert SQLite database files

Note

In order to convert a raw SQLite3 database dump (a `.sqlite3` file) you will need the [sqlite command-line tool](https://sqlite.org/cli.html) installed on your system.

If you have an existing SQLite database from another system, you can import its tables into a D1 database. Using the `sqlite` command-line tool, you can convert an `.sqlite3` file into a series of SQL statements that can be imported (executed) against a D1 database.

For example, if you have a raw SQLite dump called `db_dump.sqlite3`, run the following `sqlite` command to convert it:

```sh
sqlite3 db_dump.sqlite3 .dump > db.sql
```

Once you have run the above command, you will need to edit the output SQL file to be compatible with D1:

1. Remove `BEGIN TRANSACTION` and `COMMIT;` from the file

2. Remove the following table creation statement (if present):

   ```sql
   CREATE TABLE _cf_KV (
      key TEXT PRIMARY KEY,
      value BLOB
   ) WITHOUT ROWID;
   ```

You can then follow the steps to [import an existing database](#import-an-existing-database) into D1 by using the `.sql` file you generated from the database dump as the input to `wrangler d1 execute`.

## Export an existing D1 database

In addition to importing existing SQLite databases, you might want to export a D1 database for local development or testing. You can export a D1 database to a `.sql` file using [wrangler d1 export](https://developers.cloudflare.com/workers/wrangler/commands/#d1-export) and then execute (import) with `d1 execute --file`.

To export full D1 database schema and data:

```sh
npx wrangler d1 export <database_name> --remote --output=./database.sql
```

To export single table schema and data:

```sh
npx wrangler d1 export <database_name> --remote --table=<table_name> --output=./table.sql
```

To export only D1 database schema:

```sh
npx wrangler d1 export <database_name> --remote --output=./schema.sql --no-data
```

To export only D1 table schema:

```sh
npx wrangler d1 export <database_name> --remote --table=<table_name> --output=./schema.sql --no-data
```

To export only D1 database data:

```sh
npx wrangler d1 export <database_name> --remote --output=./data.sql --no-schema
```

To export only D1 table data:

```sh
npx wrangler d1 export <database_name> --remote --table=<table_name> --output=./data.sql --no-schema
```

### Known limitations

* Export is not supported for virtual tables, including databases with virtual tables. D1 supports virtual tables for full-text search using SQLite's [FTS5 module](https://www.sqlite.org/fts5.html). As a workaround, delete any virtual tables, export, and then recreate virtual tables.
* A running export will block other database requests.
* Any numeric value in a column is affected by JavaScript's 52-bit precision for numbers. If you store a very large number (in `int64`), then retrieve the same value, the returned value may be less precise than your original number.

## Troubleshooting

If you receive an error when trying to import an existing schema and/or dataset into D1:

* Ensure you are importing data in SQL format (typically with a `.sql` file extension). Refer to [how to convert SQLite files](#convert-sqlite-database-files) if you have a `.sqlite3` database dump.
* Make sure the schema is [SQLite3](https://www.sqlite.org/docs.html) compatible. You cannot import data from a MySQL or PostgreSQL database into D1, as the types and SQL syntax are not directly compatible.
* If you have foreign key relationships between tables, ensure you are importing the tables in the right order. You cannot refer to a table that does not yet exist.
* If you receive a `"cannot start a transaction within a transaction"` error, make sure you have removed `BEGIN TRANSACTION` and `COMMIT` from your dumped SQL statements.

### Resolve `Statement too long` error

If you encounter a `Statement too long` error when trying to import a large SQL file into D1, it means that one of the SQL statements in your file exceeds the maximum allowed length.

To resolve this issue, convert the single large `INSERT` statement into multiple smaller `INSERT` statements. For example, instead of inserting 1,000 rows in one statement, split it into four groups of 250 rows, as illustrated in the code below.

Before:

```sql
INSERT INTO users (id, full_name, created_on)
VALUES
  ('1', 'Jacquelin Elara', '2022-08-20 05:39:52'),
  ('2', 'Hubert Simmons', '2022-12-15 21:56:13'),
  ...
  ('1000', 'Boris Pewter', '2022-12-24 07:59:54');
```

After:

```sql
INSERT INTO users (id, full_name, created_on)
VALUES
  ('1', 'Jacquelin Elara', '2022-08-20 05:39:52'),
  ...
  ('100', 'Eddy Orelo', '2022-12-15 22:16:15');
...
INSERT INTO users (id, full_name, created_on)
VALUES
  ('901', 'Roran Eroi', '2022-08-20 05:39:52'),
  ...
  ('1000', 'Boris Pewter', '2022-12-15 22:16:15');
```

## Foreign key constraints

When importing data, you may need to temporarily disable [foreign key constraints](https://developers.cloudflare.com/d1/sql-api/foreign-keys/). To do so, call `PRAGMA defer_foreign_keys = true` before making changes that would violate foreign keys.

Refer to the [foreign key documentation](https://developers.cloudflare.com/d1/sql-api/foreign-keys/) to learn more about how to work with foreign keys and D1.

## Next Steps

* Read the SQLite [`CREATE TABLE`](https://www.sqlite.org/lang_createtable.html) documentation.
* Learn how to [use the D1 Workers Binding API](https://developers.cloudflare.com/d1/worker-api/) from within a Worker.
* Understand how [database migrations work](https://developers.cloudflare.com/d1/reference/migrations/) with D1.


---
title: Query a database · Cloudflare D1 docs
description: D1 is compatible with most SQLite's SQL convention since it leverages SQLite's query engine. You can use SQL commands to query D1.
lastUpdated: 2025-03-07T11:07:33.000Z
source_url:
  html: https://developers.cloudflare.com/d1/best-practices/query-d1/
  md: https://developers.cloudflare.com/d1/best-practices/query-d1/index.md
---

D1 is compatible with most SQLite's SQL convention since it leverages SQLite's query engine. You can use SQL commands to query D1.

There are a number of ways you can interact with a D1 database:

1. Using [D1 Workers Binding API](https://developers.cloudflare.com/d1/worker-api/) in your code.
2. Using [D1 REST API](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/create/).
3. Using [D1 Wrangler commands](https://developers.cloudflare.com/d1/wrangler-commands/).

## Use SQL to query D1

D1 understands SQLite semantics, which allows you to query a database using SQL statements via Workers BindingAPI or REST API (including Wrangler commands). Refer to [D1 SQL API](https://developers.cloudflare.com/d1/sql-api/sql-statements/) to learn more about supported SQL statements.

### Use foreign key relationships

When using SQL with D1, you may wish to define and enforce foreign key constraints across tables in a database. Foreign key constraints allow you to enforce relationships across tables, or prevent you from deleting rows that reference rows in other tables. An example of a foreign key relationship is shown below.

```sql
CREATE TABLE users (
    user_id INTEGER PRIMARY KEY,
    email_address TEXT,
    name TEXT,
    metadata TEXT
)


CREATE TABLE orders (
    order_id INTEGER PRIMARY KEY,
    status INTEGER,
    item_desc TEXT,
    shipped_date INTEGER,
    user_who_ordered INTEGER,
    FOREIGN KEY(user_who_ordered) REFERENCES users(user_id)
)
```

Refer to [Define foreign keys](https://developers.cloudflare.com/d1/sql-api/foreign-keys/) for more information.

### Query JSON

D1 allows you to query and parse JSON data stored within a database. For example, you can extract a value inside a JSON object.

Given the following JSON object (`type:blob`) in a column named `sensor_reading`, you can extract values from it directly.

```json
{
    "measurement": {
        "temp_f": "77.4",
        "aqi": [21, 42, 58],
        "o3": [18, 500],
        "wind_mph": "13",
        "location": "US-NY"
    }
}
```

```sql
-- Extract the temperature value
SELECT json_extract(sensor_reading, '$.measurement.temp_f')-- returns "77.4" as TEXT
```

Refer to [Query JSON](https://developers.cloudflare.com/d1/sql-api/query-json/) to learn more about querying JSON objects.

## Query D1 with Workers Binding API

Workers Binding API primarily interacts with the data plane, and allows you to query your D1 database from your Worker.

This requires you to:

1. Bind your D1 database to your Worker.
2. Prepare a statement.
3. Run the statement.

```js
export default {
    async fetch(request, env) {
        const {pathname} = new URL(request.url);
        const companyName1 = `Bs Beverages`;
        const companyName2 = `Around the Horn`;
        const stmt = env.DB.prepare(`SELECT * FROM Customers WHERE CompanyName = ?`);


        if (pathname === `/RUN`) {
            const returnValue = await stmt.bind(companyName1).run();
            return Response.json(returnValue);
        }


        return new Response(
            `Welcome to the D1 API Playground!
            \nChange the URL to test the various methods inside your index.js file.`,
        );
    },
};
```

Refer to [Workers Binding API](https://developers.cloudflare.com/d1/worker-api/) for more information.

## Query D1 with REST API

REST API primarily interacts with the control plane, and allows you to create/manage your D1 database.

Refer to [D1 REST API](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/create/) for D1 REST API documentation.

## Query D1 with Wrangler commands

You can use Wrangler commands to query a D1 database. Note that Wrangler commands use REST APIs to perform its operations.

```sh
npx wrangler d1 execute prod-d1-tutorial --command="SELECT * FROM Customers"
```

```sh
🌀 Mapping SQL input into an array of statements
🌀 Executing on local database production-db-backend (<DATABASE_ID>) from .wrangler/state/v3/d1:
┌────────────┬─────────────────────┬───────────────────┐
│ CustomerId │ CompanyName         │ ContactName       │
├────────────┼─────────────────────┼───────────────────┤
│ 1          │ Alfreds Futterkiste │ Maria Anders      │
├────────────┼─────────────────────┼───────────────────┤
│ 4          │ Around the Horn     │ Thomas Hardy      │
├────────────┼─────────────────────┼───────────────────┤
│ 11         │ Bs Beverages        │ Victoria Ashworth │
├────────────┼─────────────────────┼───────────────────┤
│ 13         │ Bs Beverages        │ Random Name       │
└────────────┴─────────────────────┴───────────────────┘
```

---
title: Use indexes · Cloudflare D1 docs
description: Indexes enable D1 to improve query performance over the indexed columns for common (popular) queries by reducing the amount of data (number of rows) the database has to scan when running a query.
lastUpdated: 2025-02-24T09:30:25.000Z
source_url:
  html: https://developers.cloudflare.com/d1/best-practices/use-indexes/
  md: https://developers.cloudflare.com/d1/best-practices/use-indexes/index.md
---

Indexes enable D1 to improve query performance over the indexed columns for common (popular) queries by reducing the amount of data (number of rows) the database has to scan when running a query.

## When is an index useful?

Indexes are useful:

* When you want to improve the read performance over columns that are regularly used in predicates - for example, a `WHERE email_address = ?` or `WHERE user_id = 'a793b483-df87-43a8-a057-e5286d3537c5'` - email addresses, usernames, user IDs and/or dates are good choices for columns to index in typical web applications or services.
* For enforcing uniqueness constraints on a column or columns - for example, an email address or user ID via the `CREATE UNIQUE INDEX`.
* In cases where you query over multiple columns together - `(customer_id, transaction_date)`.

Indexes are automatically updated when the table and column(s) they reference are inserted, updated or deleted. You do not need to manually update an index after you write to the table it references.

## Create an index

Note

Tables that use the default primary key (an `INTEGER` based `ROWID`), or that define their own `INTEGER PRIMARY KEY`, do not need to create an index for that column.

To create an index on a D1 table, use the `CREATE INDEX` SQL command and specify the table and column(s) to create the index over.

For example, given the following `orders` table, you may want to create an index on `customer_id`. Nearly all of your queries against that table filter on `customer_id`, and you would see a performance improvement by creating an index for it.

```sql
CREATE TABLE IF NOT EXISTS orders (
    order_id INTEGER PRIMARY KEY,
    customer_id STRING NOT NULL, -- for example, a unique ID aba0e360-1e04-41b3-91a0-1f2263e1e0fb
    order_date STRING NOT NULL,
    status INTEGER NOT NULL,
    last_updated_date STRING NOT NULL
)
```

To create the index on the `customer_id` column, execute the below statement against your database:

Note

A common naming format for indexes is `idx_TABLE_NAME_COLUMN_NAMES`, so that you can identify the table and column(s) your indexes are for when managing your database.

```sql
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id)
```

Queries that reference the `customer_id` column will now benefit from the index:

```sql
-- Uses the index: the indexed column is referenced by the query.
SELECT * FROM orders WHERE customer_id = ?


-- Does not use the index: customer_id is not in the query.
SELECT * FROM orders WHERE order_date = '2023-05-01'
```

In more complex cases, you can confirm whether an index was used by D1 by [analyzing a query](#test-an-index) directly.

### Run `PRAGMA optimize`

After creating an index, run the `PRAGMA optimize` command to improve your database performance.

`PRAGMA optimize` runs `ANALYZE` command on each table in the database, which collects statistics on the tables and indices. These statistics allows the query planner to generate the most efficient query plan when executing the user query.

For more information, refer to [`PRAGMA optimize`](https://developers.cloudflare.com/d1/sql-api/sql-statements/#pragma-optimize).

## List indexes

List the indexes on a database, as well as the SQL definition, by querying the `sqlite_schema` system table:

```sql
SELECT name, type, sql FROM sqlite_schema WHERE type IN ('index');
```

This will return output resembling the below:

```txt
┌──────────────────────────────────┬───────┬────────────────────────────────────────┐
│ name                             │ type  │ sql                                    │
├──────────────────────────────────┼───────┼────────────────────────────────────────┤
│ idx_users_id                     │ index │ CREATE INDEX idx_users_id ON users(id) │
└──────────────────────────────────┴───────┴────────────────────────────────────────┘
```

Note that you cannot modify this table, or an existing index. To modify an index, [delete it first](#remove-indexes) and [create a new index](#create-an-index) with the updated definition.

## Test an index

Validate that an index was used for a query by prepending a query with [`EXPLAIN QUERY PLAN`](https://www.sqlite.org/eqp.html). This will output a query plan for the succeeding statement, including which (if any) indexes were used.

For example, if you assume the `users` table has an `email_address TEXT` column and you created an index `CREATE UNIQUE INDEX idx_email_address ON users(email_address)`, any query with a predicate on `email_address` should use your index.

```sql
EXPLAIN QUERY PLAN SELECT * FROM users WHERE email_address = 'foo@example.com';
QUERY PLAN
`--SEARCH users USING INDEX idx_email_address (email_address=?)
```

Review the `USING INDEX <INDEX_NAME>` output from the query planner, confirming the index was used.

This is also a fairly common use-case for an index. Finding a user based on their email address is often a very common query type for login (authentication) systems.

Using an index can reduce the number of rows read by a query. Use the `meta` object to estimate your usage. Refer to ["Can I use an index to reduce the number of rows read by a query?"](https://developers.cloudflare.com/d1/platform/pricing/#can-i-use-an-index-to-reduce-the-number-of-rows-read-by-a-query) and ["How can I estimate my (eventual) bill?"](https://developers.cloudflare.com/d1/platform/pricing/#how-can-i-estimate-my-eventual-bill).

## Multi-column indexes

For a multi-column index (an index that specifies multiple columns), queries will only use the index if they specify either *all* of the columns, or a subset of the columns provided all columns to the "left" are also within the query.

Given an index of `CREATE INDEX idx_customer_id_transaction_date ON transactions(customer_id, transaction_date)`, the following table shows when the index is used (or not):

| Query | Index Used? |
| - | - |
| `SELECT * FROM transactions WHERE customer_id = '1234' AND transaction_date = '2023-03-25'` | Yes: specifies both columns in the index. |
| `SELECT * FROM transactions WHERE transaction_date = '2023-03-28'` | No: only specifies `transaction_date`, and does not include other leftmost columns from the index. |
| `SELECT * FROM transactions WHERE customer_id = '56789'` | Yes: specifies `customer_id`, which is the leftmost column in the index. |

Notes:

* If you created an index over three columns instead — `customer_id`, `transaction_date` and `shipping_status` — a query that uses both `customer_id` and `transaction_date` would use the index, as you are including all columns "to the left".
* With the same index, a query that uses only `transaction_date` and `shipping_status` would *not* use the index, as you have not used `customer_id` (the leftmost column) in the query.

## Partial indexes

Partial indexes are indexes over a subset of rows in a table. Partial indexes are defined by the use of a `WHERE` clause when creating the index. A partial index can be useful to omit certain rows, such as those where values are `NULL` or where rows with a specific value are present across queries.

* A concrete example of a partial index would be on a table with a `order_status INTEGER` column, where `6` might represent `"order complete"` in your application code.
* This would allow queries against orders that are yet to be fulfilled, shipped or are in-progress, which are likely to be some of the most common users (users checking their order status).
* Partial indexes also keep the index from growing unbounded over time. The index does not need to keep a row for every completed order, and completed orders are likely to be queried far fewer times than in-progress orders.

A partial index that filters out completed orders from the index would resemble the following:

```sql
CREATE INDEX idx_order_status_not_complete ON orders(order_status) WHERE order_status != 6
```

Partial indexes can be faster at read time (less rows in the index) and at write time (fewer writes to the index) than full indexes. You can also combine a partial index with a [multi-column index](#multi-column-indexes).

## Remove indexes

Use `DROP INDEX` to remove an index. Dropped indexes cannot be restored.

## Considerations

Take note of the following considerations when creating indexes:

* Indexes are not always a free performance boost. You should create indexes only on columns that reflect your most-queried columns. Indexes themselves need to be maintained. When you write to an indexed column, the database needs to write to the table and the index. The performance benefit of an index and reduction in rows read will, in nearly all cases, offset this additional write.
* You cannot create indexes that reference other tables or use non-deterministic functions, since the index would not be stable.
* Indexes cannot be updated. To add or remove a column from an index, [remove](#remove-indexes) the index and then [create a new index](#create-an-index) with the new columns.
* Indexes contribute to the overall storage required by your database: an index is effectively a table itself.

---
title: Local development · Cloudflare D1 docs
description: D1 has fully-featured support for local development, running the same version of D1 as Cloudflare runs globally. Local development uses Wrangler, the command-line interface for Workers, to manage local development sessions and state.
lastUpdated: 2025-02-12T13:41:31.000Z
source_url:
  html: https://developers.cloudflare.com/d1/best-practices/local-development/
  md: https://developers.cloudflare.com/d1/best-practices/local-development/index.md
---

D1 has fully-featured support for local development, running the same version of D1 as Cloudflare runs globally. Local development uses [Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/), the command-line interface for Workers, to manage local development sessions and state.

## Start a local development session

Note

This guide assumes you are using [Wrangler v3.0](https://blog.cloudflare.com/wrangler3/) or later.

Users new to D1 and/or Cloudflare Workers should visit the [D1 tutorial](https://developers.cloudflare.com/d1/get-started/) to install `wrangler` and deploy their first database.

Local development sessions create a standalone, local-only environment that mirrors the production environment D1 runs in so that you can test your Worker and D1 *before* you deploy to production.

An existing [D1 binding](https://developers.cloudflare.com/workers/wrangler/configuration/#d1-databases) of `DB` would be available to your Worker when running locally.

To start a local development session:

1. Confirm you are using wrangler v3.0+.

   ```sh
   wrangler --version
   ```

   ```sh
   ⛅️ wrangler 3.0.0
   ```

2. Start a local development session

   ```sh
   wrangler dev
   ```

   ```sh
   ------------------
   wrangler dev now uses local mode by default, powered by 🔥 Miniflare and 👷 workerd.
   To run an edge preview session for your Worker, use wrangler dev --remote
   Your worker has access to the following bindings:
   - D1 Databases:
     - DB: test-db (c020574a-5623-407b-be0c-cd192bab9545)
   ⎔ Starting local server...


   [mf:inf] Ready on http://127.0.0.1:8787/
   [b] open a browser, [d] open Devtools, [l] turn off local mode, [c] clear console, [x] to exit
   ```

In this example, the Worker has access to local-only D1 database. The corresponding D1 binding in your [Wrangler configuration file](https://developers.cloudflare.com/workers/wrangler/configuration/) would resemble the following:

* wrangler.jsonc

  ```jsonc
  {
    "d1_databases": [
      {
        "binding": "DB",
        "database_name": "test-db",
        "database_id": "c020574a-5623-407b-be0c-cd192bab9545"
      }
    ]
  }
  ```

* wrangler.toml

  ```toml
  [[d1_databases]]
  binding = "DB"
  database_name = "test-db"
  database_id = "c020574a-5623-407b-be0c-cd192bab9545"
  ```

Note that `wrangler dev` separates local and production (remote) data. A local session does not have access to your production data by default. To access your production (remote) database, pass the `--remote` flag when calling `wrangler dev`. Any changes you make when running in `--remote` mode cannot be undone.

Refer to the [`wrangler dev` documentation](https://developers.cloudflare.com/workers/wrangler/commands/#dev) to learn more about how to configure a local development session.

## Develop locally with Pages

You can only develop against a *local* D1 database when using [Cloudflare Pages](https://developers.cloudflare.com/pages/) by creating a minimal [Wrangler configuration file](https://developers.cloudflare.com/workers/wrangler/configuration/) in the root of your Pages project. This can be useful when creating schemas, seeding data or otherwise managing a D1 database directly, without adding to your application logic.

Local development for remote databases

It is currently not possible to develop against a *remote* D1 database when using [Cloudflare Pages](https://developers.cloudflare.com/pages/).

Your [Wrangler configuration file](https://developers.cloudflare.com/workers/wrangler/configuration/) should resemble the following:

* wrangler.jsonc

  ```jsonc
  {
    "d1_databases": [
      {
        "binding": "DB",
        "database_name": "YOUR_DATABASE_NAME",
        "database_id": "the-id-of-your-D1-database-goes-here",
        "preview_database_id": "DB"
      }
    ]
  }
  ```

* wrangler.toml

  ```toml
  # If you are only using Pages + D1, you only need the below in your Wrangler config file to interact with D1 locally.
  [[d1_databases]]
  binding = "DB" # Should match preview_database_id
  database_name = "YOUR_DATABASE_NAME"
  database_id = "the-id-of-your-D1-database-goes-here" # wrangler d1 info YOUR_DATABASE_NAME
  preview_database_id = "DB" # Required for Pages local development
  ```

You can then execute queries and/or run migrations against a local database as part of your local development process by passing the `--local` flag to wrangler:

```bash
wrangler d1 execute YOUR_DATABASE_NAME \
  --local --command "CREATE TABLE IF NOT EXISTS users ( user_id INTEGER PRIMARY KEY, email_address TEXT, created_at INTEGER, deleted INTEGER, settings TEXT);"
```

The preceding command would execute queries the **local only** version of your D1 database. Without the `--local` flag, the commands are executed against the remote version of your D1 database running on Cloudflare's network.

## Persist data

Note

By default, in Wrangler v3 and above, data is persisted across each run of `wrangler dev`. If your local development and testing requires or assumes an empty database, you should start with a `DROP TABLE <tablename>` statement to delete existing tables before using `CREATE TABLE` to re-create them.

Use `wrangler dev --persist-to=/path/to/file` to persist data to a specific location. This can be useful when working in a team (allowing you to share) the same copy, when deploying via CI/CD (to ensure the same starting state), or as a way to keep data when migrating across machines.

Users of wrangler `2.x` must use the `--persist` flag: previous versions of wrangler did not persist data by default.

## Test programmatically

### Miniflare

[Miniflare](https://miniflare.dev/) allows you to simulate a Workers and resources like D1 using the same underlying runtime and code as used in production.

You can use Miniflare's [support for D1](https://miniflare.dev/storage/d1) to create D1 databases you can use for testing:

* wrangler.jsonc

  ```jsonc
  {
    "d1_databases": [
      {
        "binding": "DB",
        "database_name": "test-db",
        "database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
      }
    ]
  }
  ```

* wrangler.toml

  ```toml
  [[d1_databases]]
  binding = "DB"
  database_name = "test-db"
  database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  ```

```js
const mf = new Miniflare({
  d1Databases: {
    DB: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  },
});
```

You can then use the `getD1Database()` method to retrieve the simulated database and run queries against it as if it were your real production D1 database:

```js
const db = await mf.getD1Database("DB");


const stmt = db.prepare("SELECT name, age FROM users LIMIT 3");
const { results } = await stmt.all();


console.log(results);
```

### `unstable_dev`

Wrangler exposes an [`unstable_dev()`](https://developers.cloudflare.com/workers/wrangler/api/) that allows you to run a local HTTP server for testing Workers and D1. Run [migrations](https://developers.cloudflare.com/d1/reference/migrations/) against a local database by setting a `preview_database_id` in your Wrangler configuration.

Given the below Wrangler configuration:

* wrangler.jsonc

  ```jsonc
  {
    "d1_databases": [
      {
        "binding": "DB",
        "database_name": "your-database",
        "database_id": "<UUID>",
        "preview_database_id": "local-test-db"
      }
    ]
  }
  ```

* wrangler.toml

  ```toml
  [[ d1_databases ]]
  binding = "DB" # i.e. if you set this to "DB", it will be available in your Worker at `env.DB`
  database_name = "your-database" # the name of your D1 database, set when created
  database_id = "<UUID>" # The unique ID of your D1 database, returned when you create your database or run `
  preview_database_id = "local-test-db" # A user-defined ID for your local test database.
  ```

Migrations can be run locally as part of your CI/CD setup by passing the `--local` flag to `wrangler`:

```sh
wrangler d1 migrations apply your-database --local
```

### Usage example

The following example shows how to use Wrangler's `unstable_dev()` API to:

* Run migrations against your local test database, as defined by `preview_database_id`.
* Make a request to an endpoint defined in your Worker. This example uses `/api/users/?limit=2`.
* Validate the returned results match, including the `Response.status` and the JSON our API returns.

```ts
import { unstable_dev } from "wrangler";
import type { UnstableDevWorker } from "wrangler";


describe("Test D1 Worker endpoint", () => {
  let worker: UnstableDevWorker;


  beforeAll(async () => {
    // Optional: Run any migrations to set up your `--local` database
    // By default, this will default to the preview_database_id
    execSync(`NO_D1_WARNING=true wrangler d1 migrations apply db --local`);


    worker = await unstable_dev("src/index.ts", {
      experimental: { disableExperimentalWarning: true },
    });
  });


  afterAll(async () => {
    await worker.stop();
  });


  it("should return an array of users", async () => {
    // Our expected results
    const expectedResults = `{"results": [{"user_id": 1234, "email": "foo@example.com"},{"user_id": 6789, "email": "bar@example.com"}]}`;
    // Pass an optional URL to fetch to trigger any routing within your Worker
    const resp = await worker.fetch("/api/users/?limit=2");
    if (resp) {
      // https://jestjs.io/docs/expect#tobevalue
      expect(resp.status).toBe(200);
      const data = await resp.json();
      // https://jestjs.io/docs/expect#tomatchobjectobject
      expect(data).toMatchObject(expectedResults);
    }
  });
});
```

Review the [`unstable_dev()`](https://developers.cloudflare.com/workers/wrangler/api/#usage) documentation for more details on how to use the API within your tests.

## Related resources

* Use [`wrangler dev`](https://developers.cloudflare.com/workers/wrangler/commands/#dev) to run your Worker and D1 locally and debug issues before deploying.
* Learn [how to debug D1](https://developers.cloudflare.com/d1/observability/debug-d1/).
* Understand how to [access logs](https://developers.cloudflare.com/workers/observability/logs/) generated from your Worker and D1.

---
title: Remote development · Cloudflare D1 docs
description: D1 supports remote development using the dashboard playground. The dashboard playground uses a browser version of Visual Studio Code, allowing you to rapidly iterate on your Worker entirely in your browser.
lastUpdated: 2024-12-11T09:43:45.000Z
source_url:
  html: https://developers.cloudflare.com/d1/best-practices/remote-development/
  md: https://developers.cloudflare.com/d1/best-practices/remote-development/index.md
---

D1 supports remote development using the [dashboard playground](https://developers.cloudflare.com/workers/playground/#use-the-playground). The dashboard playground uses a browser version of Visual Studio Code, allowing you to rapidly iterate on your Worker entirely in your browser.

## 1. Bind a D1 database to a Worker

Note

This guide assumes you have previously created a Worker, and a D1 database.

Users new to D1 and/or Cloudflare Workers should read the [D1 tutorial](https://developers.cloudflare.com/d1/get-started/) to install `wrangler` and deploy their first database.

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com) and select your account.
2. Go to [**Workers & Pages** > **Overview**](https://dash.cloudflare.com/?to=/:account/workers-and-pages).
3. Select an existing Worker.
4. Select the **Settings** tab.
5. Select the **Variables** sub-tab.
6. Scroll down to the **D1 Database Bindings** heading.
7. Enter a variable name, such as `DB`, and select the D1 database you wish to access from this Worker.
8. Select **Save and deploy**.

## 2. Start a remote development session

1. On the Worker's page on the Cloudflare dashboard, select **Edit Code** at the top of the page.
2. Your Worker now has access to D1.

Use the following Worker script to verify that the Worker has access to the bound D1 database:

```js
export default {
  async fetch(request, env, ctx) {
    const res = await env.DB.prepare("SELECT 1;").all();
    return new Response(JSON.stringify(res, null, 2));
  },
};
```

## Related resources

* Learn [how to debug D1](https://developers.cloudflare.com/d1/observability/debug-d1/).
* Understand how to [access logs](https://developers.cloudflare.com/workers/observability/logs/) generated from your Worker and D1.

---
title: Bindings · Cloudflare Pages docs
description: A binding enables your Pages Functions to interact with resources on the Cloudflare developer platform. Use bindings to integrate your Pages Functions with Cloudflare resources like KV, Durable Objects, R2, and D1. You can set bindings for both production and preview environments.
lastUpdated: 2025-05-09T17:32:11.000Z
source_url:
  html: https://developers.cloudflare.com/pages/functions/bindings/
  md: https://developers.cloudflare.com/pages/functions/bindings/index.md
---

A [binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/) enables your Pages Functions to interact with resources on the Cloudflare developer platform. Use bindings to integrate your Pages Functions with Cloudflare resources like [KV](https://developers.cloudflare.com/kv/concepts/how-kv-works/), [Durable Objects](https://developers.cloudflare.com/durable-objects/), [R2](https://developers.cloudflare.com/r2/), and [D1](https://developers.cloudflare.com/d1/). You can set bindings for both production and preview environments.

This guide will instruct you on configuring a binding for your Pages Function. You must already have a Cloudflare Developer Platform resource set up to continue.

Note

Pages Functions only support a subset of all [bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/), which are listed on this page.

## KV namespaces

[Workers KV](https://developers.cloudflare.com/kv/concepts/kv-namespaces/) is Cloudflare's key-value storage solution.

To bind your KV namespace to your Pages Function, you can configure a KV namespace binding in the [Wrangler configuration file](https://developers.cloudflare.com/pages/functions/wrangler-configuration/#kv-namespaces) or the Cloudflare dashboard.

To configure a KV namespace binding via the Cloudflare dashboard:

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com) and select your account.
2. In **Account Home**, select **Workers & Pages**.
3. Select your Pages project > **Settings**.
4. Select your Pages environment > **Bindings** > **Add** > **KV namespace**.
5. Give your binding a name under **Variable name**.
6. Under **KV namespace**, select your desired namespace.
7. Redeploy your project for the binding to take effect.

Below is an example of how to use KV in your Function. In the following example, your KV namespace binding is called `TODO_LIST` and you can access the binding in your Function code on `context.env`:

* JavaScript

  ```js
  export async function onRequest(context) {
    const task = await context.env.TODO_LIST.get("Task:123");
    return new Response(task);
  }
  ```

* TypeScript

  ```ts
  interface Env {
    TODO_LIST: KVNamespace;
  }


  export const onRequest: PagesFunction<Env> = async (context) => {
    const task = await context.env.TODO_LIST.get("Task:123");
    return new Response(task);
  };
  ```

### Interact with your KV namespaces locally

You can interact with your KV namespace bindings locally in one of two ways:

* Configure your Pages project's Wrangler file and run [`npx wrangler pages dev`](https://developers.cloudflare.com/workers/wrangler/commands/#dev-1).
* Pass arguments to `wrangler pages dev` directly.

To interact with your KV namespace binding locally by passing arguments to the Wrangler CLI, add `-k <BINDING_NAME>` or `--kv=<BINDING_NAME>` to the `wrangler pages dev` command. For example, if your KV namespace is bound your Function via the `TODO_LIST` binding, access the KV namespace in local development by running:

```sh
npx wrangler pages dev <OUTPUT_DIR> --kv=TODO_LIST
```

Note

If a binding is specified in a [Wrangler configuration file](https://developers.cloudflare.com/workers/wrangler/configuration/) and via a command-line argument, the command-line argument takes precedence.

## Durable Objects

[Durable Objects](https://developers.cloudflare.com/durable-objects/) (DO) are Cloudflare's strongly consistent data store that power capabilities such as connecting WebSockets and handling state.

You must create a Durable Object Worker and bind it to your Pages project using the Cloudflare dashboard or your Pages project's [Wrangler configuration file](https://developers.cloudflare.com/pages/functions/wrangler-configuration/). You cannot create and deploy a Durable Object within a Pages project.

To bind your Durable Object to your Pages Function, you can configure a Durable Object binding in the [Wrangler configuration file](https://developers.cloudflare.com/pages/functions/wrangler-configuration/#kv-namespaces) or the Cloudflare dashboard.

To configure a Durable Object binding via the Cloudflare dashboard:

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com) and select your account.
2. In **Account Home**, select **Workers & Pages**.
3. Select your Pages project > **Settings**.
4. Select your Pages environment > **Bindings** > **Add** > **Durable Object**.
5. Give your binding a name under **Variable name**.
6. Under **Durable Object namespace**, select your desired namespace.
7. Redeploy your project for the binding to take effect.

Below is an example of how to use Durable Objects in your Function. In the following example, your DO binding is called `DURABLE_OBJECT` and you can access the binding in your Function code on `context.env`:

* JavaScript

  ```js
  export async function onRequestGet(context) {
    const id = context.env.DURABLE_OBJECT.newUniqueId();
    const stub = context.env.DURABLE_OBJECT.get(id);


    // Pass the request down to the durable object
    return stub.fetch(context.request);
  }
  ```

* TypeScript

  ```ts
  interface Env {
    DURABLE_OBJECT: DurableObjectNamespace;
  }


  export const onRequestGet: PagesFunction<Env> = async (context) => {
    const id = context.env.DURABLE_OBJECT.newUniqueId();
    const stub = context.env.DURABLE_OBJECT.get(id);


    // Pass the request down to the durable object
    return stub.fetch(context.request);
  };
  ```

### Interact with your Durable Object namespaces locally

You can interact with your Durable Object bindings locally in one of two ways:

* Configure your Pages project's Wrangler file and run [`npx wrangler pages dev`](https://developers.cloudflare.com/workers/wrangler/commands/#dev-1).
* Pass arguments to `wrangler pages dev` directly.

While developing locally, to interact with a Durable Object namespace, run `wrangler dev` in the directory of the Worker exporting the Durable Object. In another terminal, run `wrangler pages dev` in the directory of your Pages project.

To interact with your Durable Object namespace locally via the Wrangler CLI, append `--do <BINDING_NAME>=<CLASS_NAME>@<SCRIPT_NAME>` to `wrangler pages dev`. `CLASS_NAME` indicates the Durable Object class name and `SCRIPT_NAME` the name of your Worker.

For example, if your Worker is called `do-worker` and it declares a Durable Object class called `DurableObjectExample`, access this Durable Object by running `npx wrangler dev` in the `do-worker` directory. At the same time, run `npx wrangler pages dev <OUTPUT_DIR> --do MY_DO=DurableObjectExample@do-worker` in your Pages' project directory. Interact with the `MY_DO` binding in your Function code by using `context.env` (for example, `context.env.MY_DO`).

Note

If a binding is specified in a [Wrangler configuration file](https://developers.cloudflare.com/workers/wrangler/configuration/) and via a command-line argument, the command-line argument takes precedence.

## R2 buckets

[R2](https://developers.cloudflare.com/r2/) is Cloudflare's blob storage solution that allows developers to store large amounts of unstructured data without the egress fees.

To bind your R2 bucket to your Pages Function, you can configure a R2 bucket binding in the [Wrangler configuration file](https://developers.cloudflare.com/pages/functions/wrangler-configuration/#r2-buckets) or the Cloudflare dashboard.

To configure a R2 bucket binding via the Cloudflare dashboard:

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com) and select your account.
2. In **Account Home**, select **Workers & Pages**.
3. Select your Pages project > **Settings**.
4. Select your Pages environment > **Bindings** > **Add** > **R2 bucket**.
5. Give your binding a name under **Variable name**.
6. Under **R2 bucket**, select your desired R2 bucket.
7. Redeploy your project for the binding to take effect.

Below is an example of how to use R2 buckets in your Function. In the following example, your R2 bucket binding is called `BUCKET` and you can access the binding in your Function code on `context.env`:

* JavaScript

  ```js
  export async function onRequest(context) {
    const obj = await context.env.BUCKET.get("some-key");
    if (obj === null) {
      return new Response("Not found", { status: 404 });
    }
    return new Response(obj.body);
  }
  ```

* TypeScript

  ```ts
  interface Env {
    BUCKET: R2Bucket;
  }


  export const onRequest: PagesFunction<Env> = async (context) => {
    const obj = await context.env.BUCKET.get("some-key");
    if (obj === null) {
      return new Response("Not found", { status: 404 });
    }
    return new Response(obj.body);
  };
  ```

### Interact with your R2 buckets locally

You can interact with your R2 bucket bindings locally in one of two ways:

* Configure your Pages project's Wrangler file and run [`npx wrangler pages dev`](https://developers.cloudflare.com/workers/wrangler/commands/#dev-1).
* Pass arguments to `wrangler pages dev` directly.

Note

By default, Wrangler automatically persists data to local storage. For more information, refer to [Local development](https://developers.cloudflare.com/workers/local-development/).

To interact with an R2 bucket locally via the Wrangler CLI, add `--r2=<BINDING_NAME>` to the `wrangler pages dev` command. If your R2 bucket is bound to your Function with the `BUCKET` binding, access this R2 bucket in local development by running:

```sh
npx wrangler pages dev <OUTPUT_DIR> --r2=BUCKET
```

Interact with this binding by using `context.env` (for example, `context.env.BUCKET`.)

Note

If a binding is specified in a [Wrangler configuration file](https://developers.cloudflare.com/workers/wrangler/configuration/) and via a command-line argument, the command-line argument takes precedence.

## D1 databases

[D1](https://developers.cloudflare.com/d1/) is Cloudflare’s native serverless database.

To bind your D1 database to your Pages Function, you can configure a D1 database binding in the [Wrangler configuration file](https://developers.cloudflare.com/pages/functions/wrangler-configuration/#d1-databases) or the Cloudflare dashboard.

To configure a D1 database binding via the Cloudflare dashboard:

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com) and select your account.
2. In **Account Home**, select **Workers & Pages**.
3. Select your Pages project > **Settings**.
4. Select your Pages environment > **Bindings** > **Add**> **D1 database bindings**.
5. Give your binding a name under **Variable name**.
6. Under **D1 database**, select your desired D1 database.
7. Redeploy your project for the binding to take effect.

Below is an example of how to use D1 in your Function. In the following example, your D1 database binding is `NORTHWIND_DB` and you can access the binding in your Function code on `context.env`:

* JavaScript

  ```js
  export async function onRequest(context) {
    // Create a prepared statement with our query
    const ps = context.env.NORTHWIND_DB.prepare("SELECT * from users");
    const data = await ps.first();


    return Response.json(data);
  }
  ```

* TypeScript

  ```ts
  interface Env {
    NORTHWIND_DB: D1Database;
  }


  export const onRequest: PagesFunction<Env> = async (context) => {
    // Create a prepared statement with our query
    const ps = context.env.NORTHWIND_DB.prepare("SELECT * from users");
    const data = await ps.first();


    return Response.json(data);
  };
  ```

### Interact with your D1 databases locally

You can interact with your D1 database bindings locally in one of two ways:

* Configure your Pages project's Wrangler file and run [`npx wrangler pages dev`](https://developers.cloudflare.com/workers/wrangler/commands/#dev-1).
* Pass arguments to `wrangler pages dev` directly.

To interact with a D1 database via the Wrangler CLI while [developing locally](https://developers.cloudflare.com/d1/best-practices/local-development/#develop-locally-with-pages), add `--d1 <BINDING_NAME>=<DATABASE_ID>` to the `wrangler pages dev` command.

If your D1 database is bound to your Pages Function via the `NORTHWIND_DB` binding and the `database_id` in your Wrangler file is `xxxx-xxxx-xxxx-xxxx-xxxx`, access this database in local development by running:

```sh
npx wrangler pages dev <OUTPUT_DIR> --d1 NORTHWIND_DB=xxxx-xxxx-xxxx-xxxx-xxxx
```

Interact with this binding by using `context.env` (for example, `context.env.NORTHWIND_DB`.)

Note

By default, Wrangler automatically persists data to local storage. For more information, refer to [Local development](https://developers.cloudflare.com/workers/local-development/).

Refer to the [D1 Workers Binding API documentation](https://developers.cloudflare.com/d1/worker-api/) for the API methods available on your D1 binding.

Note

If a binding is specified in a [Wrangler configuration file](https://developers.cloudflare.com/workers/wrangler/configuration/) and via a command-line argument, the command-line argument takes precedence.

## Vectorize indexes

[Vectorize](https://developers.cloudflare.com/vectorize/) is Cloudflare’s native vector database.

To bind your Vectorize index to your Pages Function, you can configure a Vectorize index binding in the [Wrangler configuration file](https://developers.cloudflare.com/pages/functions/wrangler-configuration/#vectorize-indexes) or the Cloudflare dashboard.

To configure a Vectorize index binding via the Cloudflare dashboard:

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com) and select your account.
2. In **Account Home**, select **Workers & Pages**.
3. Choose whether you would like to set up the binding in your **Production** or **Preview** environment.
4. Select your Pages project > **Settings**.
5. Select your Pages environment > **Bindings** > **Add** > **Vectorize index**.
6. Give your binding a name under **Variable name**.
7. Under **Vectorize index**, select your desired Vectorize index.
8. Redeploy your project for the binding to take effect.

### Use Vectorize index bindings

To use Vectorize index in your Pages Function, you can access your Vectorize index binding in your Pages Function code. In the following example, your Vectorize index binding is called `VECTORIZE_INDEX` and you can access the binding in your Pages Function code on `context.env`.

* JavaScript

  ```js
  // Sample vectors: 3 dimensions wide.
  //
  // Vectors from a machine-learning model are typically ~100 to 1536 dimensions
  // wide (or wider still).
  const sampleVectors = [
    {
      id: "1",
      values: [32.4, 74.1, 3.2],
      metadata: { url: "/products/sku/13913913" },
    },
    {
      id: "2",
      values: [15.1, 19.2, 15.8],
      metadata: { url: "/products/sku/10148191" },
    },
    {
      id: "3",
      values: [0.16, 1.2, 3.8],
      metadata: { url: "/products/sku/97913813" },
    },
    {
      id: "4",
      values: [75.1, 67.1, 29.9],
      metadata: { url: "/products/sku/418313" },
    },
    {
      id: "5",
      values: [58.8, 6.7, 3.4],
      metadata: { url: "/products/sku/55519183" },
    },
  ];


  export async function onRequest(context) {
    let path = new URL(context.request.url).pathname;
    if (path.startsWith("/favicon")) {
      return new Response("", { status: 404 });
    }


    // You only need to insert vectors into your index once
    if (path.startsWith("/insert")) {
      // Insert some sample vectors into your index
      // In a real application, these vectors would be the output of a machine learning (ML) model,
      // such as Workers AI, OpenAI, or Cohere.
      let inserted = await context.env.VECTORIZE_INDEX.insert(sampleVectors);


      // Return the number of IDs we successfully inserted
      return Response.json(inserted);
    }
  }
  ```

* TypeScript

  ```ts
  export interface Env {
    // This makes our vector index methods available on context.env.VECTORIZE_INDEX.*
    // For example, context.env.VECTORIZE_INDEX.insert() or query()
    VECTORIZE_INDEX: VectorizeIndex;
  }


  // Sample vectors: 3 dimensions wide.
  //
  // Vectors from a machine-learning model are typically ~100 to 1536 dimensions
  // wide (or wider still).
  const sampleVectors: Array<VectorizeVector> = [
    {
      id: "1",
      values: [32.4, 74.1, 3.2],
      metadata: { url: "/products/sku/13913913" },
    },
    {
      id: "2",
      values: [15.1, 19.2, 15.8],
      metadata: { url: "/products/sku/10148191" },
    },
    {
      id: "3",
      values: [0.16, 1.2, 3.8],
      metadata: { url: "/products/sku/97913813" },
    },
    {
      id: "4",
      values: [75.1, 67.1, 29.9],
      metadata: { url: "/products/sku/418313" },
    },
    {
      id: "5",
      values: [58.8, 6.7, 3.4],
      metadata: { url: "/products/sku/55519183" },
    },
  ];


  export const onRequest: PagesFunction<Env> = async (context) => {
    let path = new URL(context.request.url).pathname;
    if (path.startsWith("/favicon")) {
      return new Response("", { status: 404 });
    }


    // You only need to insert vectors into your index once
    if (path.startsWith("/insert")) {
      // Insert some sample vectors into your index
      // In a real application, these vectors would be the output of a machine learning (ML) model,
      // such as Workers AI, OpenAI, or Cohere.
      let inserted = await context.env.VECTORIZE_INDEX.insert(sampleVectors);


      // Return the number of IDs we successfully inserted
      return Response.json(inserted);
    }
  };
  ```

## Workers AI

[Workers AI](https://developers.cloudflare.com/workers-ai/) allows you to run machine learning models, powered by serverless GPUs, on Cloudflare’s global network.

To bind Workers AI to your Pages Function, you can configure a Workers AI binding in the [Wrangler configuration file](https://developers.cloudflare.com/pages/functions/wrangler-configuration/#workers-ai) or the Cloudflare dashboard.

When developing locally using Wrangler, you can define an AI binding using the `--ai` flag. Start Wrangler in development mode by running [`wrangler pages dev --ai AI`](https://developers.cloudflare.com/workers/wrangler/commands/#dev) to expose the `context.env.AI` binding.

To configure a Workers AI binding via the Cloudflare dashboard:

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com) and select your account.
2. In **Account Home**, select **Workers & Pages**.
3. Select your Pages project > **Settings**.
4. Select your Pages environment > **Bindings** > **Add** > **Workers AI**.
5. Give your binding a name under **Variable name**.
6. Redeploy your project for the binding to take effect.

### Use Workers AI bindings

To use Workers AI in your Pages Function, you can access your Workers AI binding in your Pages Function code. In the following example, your Workers AI binding is called `AI` and you can access the binding in your Pages Function code on `context.env`.

* JavaScript

  ```js
  export async function onRequest(context) {
    const input = { prompt: "What is the origin of the phrase Hello, World" };


    const answer = await context.env.AI.run(
      "@cf/meta/llama-3.1-8b-instruct",
      input,
    );


    return Response.json(answer);
  }
  ```

* TypeScript

  ```ts
  interface Env {
    AI: Ai;
  }


  export const onRequest: PagesFunction<Env> = async (context) => {
    const input = { prompt: "What is the origin of the phrase Hello, World" };


    const answer = await context.env.AI.run(
      "@cf/meta/llama-3.1-8b-instruct",
      input,
    );


    return Response.json(answer);
  };
  ```

### Interact with your Workers AI binding locally

Workers AI local development usage charges

Using Workers AI always accesses your Cloudflare account in order to run AI models and will incur usage charges even in local development.

You can interact with your Workers AI bindings locally in one of two ways:

* Configure your Pages project's Wrangler file and run [`npx wrangler pages dev`](https://developers.cloudflare.com/workers/wrangler/commands/#dev-1).
* Pass arguments to `wrangler pages dev` directly.

To interact with a Workers AI binding via the Wrangler CLI while developing locally, run:

```sh
npx wrangler pages dev --ai=<BINDING_NAME>
```

Note

If a binding is specified in a [Wrangler configuration file](https://developers.cloudflare.com/workers/wrangler/configuration/) and via a command-line argument, the command-line argument takes precedence.

## Service bindings

[Service bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/) enable you to call a Worker from within your Pages Function.

To bind your Pages Function to a Worker, configure a Service binding in your Pages Function using the [Wrangler configuration file](https://developers.cloudflare.com/pages/functions/wrangler-configuration/#service-bindings) or the Cloudflare dashboard.

To configure a Service binding via the Cloudflare dashboard:

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com) and select your account.
2. In **Account Home**, select **Workers & Pages**.
3. Select your Pages project > **Settings**.
4. Select your Pages environment > **Bindings** > **Add** > **Service binding**.
5. Give your binding a name under **Variable name**.
6. Under **Service**, select your desired Worker.
7. Redeploy your project for the binding to take effect.

Below is an example of how to use Service bindings in your Function. In the following example, your Service binding is called `SERVICE` and you can access the binding in your Function code on `context.env`:

* JavaScript

  ```js
  export async function onRequestGet(context) {
    return context.env.SERVICE.fetch(context.request);
  }
  ```

* TypeScript

  ```ts
  interface Env {
    SERVICE: Fetcher;
  }


  export const onRequest: PagesFunction<Env> = async (context) => {
    return context.env.SERVICE.fetch(context.request);
  };
  ```

### Interact with your Service bindings locally

You can interact with your Service bindings locally in one of two ways:

* Configure your Pages project's Wrangler file and run [`npx wrangler pages dev`](https://developers.cloudflare.com/workers/wrangler/commands/#dev-1).
* Pass arguments to `wrangler pages dev` directly.

To interact with a [Service binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/) while developing locally, run the Worker you want to bind to via `wrangler dev` and in parallel, run `wrangler pages dev` with `--service <BINDING_NAME>=<SCRIPT_NAME>` where `SCRIPT_NAME` indicates the name of the Worker. For example, if your Worker is called `my-worker`, connect with this Worker by running it via `npx wrangler dev` (in the Worker's directory) alongside `npx wrangler pages dev <OUTPUT_DIR> --service MY_SERVICE=my-worker` (in the Pages' directory). Interact with this binding by using `context.env` (for example, `context.env.MY_SERVICE`).

If you set up the Service binding via the Cloudflare dashboard, you will need to append `wrangler pages dev` with `--service <BINDING_NAME>=<SCRIPT_NAME>` where `BINDING_NAME` is the name of the Service binding and `SCRIPT_NAME` is the name of the Worker.

For example, to develop locally, if your Worker is called `my-worker`, run `npx wrangler dev` in the `my-worker` directory. In a different terminal, also run `npx wrangler pages dev <OUTPUT_DIR> --service MY_SERVICE=my-worker` in your Pages project directory. Interact with this Service binding by using `context.env` (for example, `context.env.MY_SERVICE`).

Wrangler also supports running your Pages project and bound Workers in the same dev session with one command. To try it out, pass multiple -c flags to Wrangler, like this: `wrangler pages dev -c wrangler.toml -c ../other-worker/wrangler.toml`. The first argument must point to your Pages configuration file, and the subsequent configurations will be accessible via a Service binding from your Pages project.

Warning

Support for running multiple Workers in the same dev session with one Wrangler command is experimental, and subject to change as we work on the experience. If you run into bugs or have any feedback, [open an issue on the workers-sdk repository](https://github.com/cloudflare/workers-sdk/issues/new)

Note

If a binding is specified in a [Wrangler configuration file](https://developers.cloudflare.com/workers/wrangler/configuration/) and via a command-line argument, the command-line argument takes precedence.

## Queue Producers

[Queue Producers](https://developers.cloudflare.com/queues/configuration/javascript-apis/#producer) enable you to send messages into a queue within your Pages Function.

To bind a queue to your Pages Function, configure a queue producer binding in your Pages Function using the [Wrangler configuration file](https://developers.cloudflare.com/pages/functions/wrangler-configuration/#queues-producers) or the Cloudflare dashboard:

To configure a queue producer binding via the Cloudflare dashboard:

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com) and select your account.
2. In **Account Home**, select **Workers & Pages**.
3. Select your Pages project > **Settings**.
4. Select your Pages environment > **Functions** > **Add** > **Queue**.
5. Give your binding a name under **Variable name**.
6. Under **Queue**, select your desired queue.
7. Redeploy your project for the binding to take effect.

Below is an example of how to use a queue producer binding in your Function. In this example, the binding is named `MY_QUEUE` and you can access the binding in your Function code on `context.env`:

* JavaScript

  ```js
  export async function onRequest(context) {
    await context.env.MY_QUEUE.send({
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers),
    });


    return new Response("Sent!");
  }
  ```

* TypeScript

  ```ts
  interface Env {
    MY_QUEUE: Queue<any>;
  }


  export const onRequest: PagesFunction<Env> = async (context) => {
    await context.env.MY_QUEUE.send({
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers),
    });


    return new Response("Sent!");
  };
  ```

### Interact with your Queue Producer binding locally

If using a queue producer binding with a Pages Function, you will be able to send events to a queue locally. However, it is not possible to consume events from a queue with a Pages Function. You will have to create a [separate consumer Worker](https://developers.cloudflare.com/queues/get-started/#5-create-your-consumer-worker) with a [queue consumer handler](https://developers.cloudflare.com/queues/configuration/javascript-apis/#consumer) to consume events from the queue. Wrangler does not yet support running separate producer Functions and consumer Workers bound to the same queue locally.

## Hyperdrive configs

Note

PostgreSQL drivers like [`Postgres.js`](https://github.com/porsager/postgres) depend on Node.js APIs. Pages Functions with Hyperdrive bindings must be [deployed with Node.js compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs).

* wrangler.jsonc

  ```jsonc
  {
    "compatibility_flags": [
      "nodejs_compat"
    ],
    "compatibility_date": "2024-09-23"
  }
  ```

* wrangler.toml

  ```toml
  compatibility_flags = [ "nodejs_compat" ]
  compatibility_date = "2024-09-23"
  ```

[Hyperdrive](https://developers.cloudflare.com/hyperdrive/) is a service for connecting to your existing databases from Cloudflare Workers and Pages Functions.

To bind your Hyperdrive config to your Pages Function, you can configure a Hyperdrive binding in the [Wrangler configuration file](https://developers.cloudflare.com/pages/functions/wrangler-configuration/#hyperdrive) or the Cloudflare dashboard.

To configure a Hyperdrive binding via the Cloudflare dashboard:

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com) and select your account.
2. In **Account Home**, select **Workers & Pages**.
3. Select your Pages project > **Settings**.
4. Select your Pages environment > **Bindings** > **Add** > **Hyperdrive**.
5. Give your binding a name under **Variable name**.
6. Under **Hyperdrive configuration**, select your desired configuration.
7. Redeploy your project for the binding to take effect.

Below is an example of how to use Hyperdrive in your Function. In the following example, your Hyperdrive config is named `HYPERDRIVE` and you can access the binding in your Function code on `context.env`:

* JavaScript

  ```js
  import postgres from "postgres";


  export async function onRequest(context) {
    // create connection to postgres database
    const sql = postgres(context.env.HYPERDRIVE.connectionString);


    try {
      const result = await sql`SELECT id, name, value FROM records`;


      return Response.json({result: result})
    } catch (e) {
      return Response.json({error: e.message, {status: 500}});
    }
  }
  ```

* TypeScript

  ```ts
  import postgres from "postgres";


  interface Env {
    HYPERDRIVE: Hyperdrive;
  }


  type MyRecord = {
    id: number;
    name: string;
    value: string;
  };


  export const onRequest: PagesFunction<Env> = async (context) => {
    // create connection to postgres database
    const sql = postgres(context.env.HYPERDRIVE.connectionString);


    try {
      const result = await sql<MyRecord[]>`SELECT id, name, value FROM records`;


      return Response.json({result: result})
    } catch (e) {
      return Response.json({error: e.message, {status: 500}});
    }
  };
  ```

### Interact with your Hyperdrive binding locally

To interact with your Hyperdrive binding locally, you must provide a local connection string to your database that your Pages project will connect to directly. You can set an environment variable `WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_<BINDING_NAME>` with the connection string of the database, or use the Wrangler file to configure your Hyperdrive binding with a `localConnectionString` as specified in [Hyperdrive documentation for local development](https://developers.cloudflare.com/hyperdrive/configuration/local-development/). Then, run [`npx wrangler pages dev <OUTPUT_DIR>`](https://developers.cloudflare.com/workers/wrangler/commands/#dev-1).

## Analytics Engine

The [Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/) binding enables you to write analytics within your Pages Function.

To bind an Analytics Engine dataset to your Pages Function, you must configure an Analytics Engine binding using the [Wrangler configuration file](https://developers.cloudflare.com/pages/functions/wrangler-configuration/#analytics-engine-datasets) or the Cloudflare dashboard:

To configure an Analytics Engine binding via the Cloudflare dashboard:

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com) and select your account.
2. In **Account Home**, select **Workers & Pages**.
3. Select your Pages project > **Settings**.
4. Select your Pages environment > **Bindings** > **Add** > **Analytics engine**.
5. Give your binding a name under **Variable name**.
6. Under **Dataset**, input your desired dataset.
7. Redeploy your project for the binding to take effect.

Below is an example of how to use an Analytics Engine binding in your Function. In the following example, the binding is called `ANALYTICS_ENGINE` and you can access the binding in your Function code on `context.env`:

* JavaScript

  ```js
  export async function onRequest(context) {
    const url = new URL(context.request.url);


    context.env.ANALYTICS_ENGINE.writeDataPoint({
      indexes: [],
      blobs: [url.hostname, url.pathname],
      doubles: [],
    });


    return new Response("Logged analytic");
  }
  ```

* TypeScript

  ```ts
  interface Env {
    ANALYTICS_ENGINE: AnalyticsEngineDataset;
  }


  export const onRequest: PagesFunction<Env> = async (context) => {
    const url = new URL(context.request.url);


    context.env.ANALYTICS_ENGINE.writeDataPoint({
      indexes: [],
      blobs: [url.hostname, url.pathname],
      doubles: [],
    });


    return new Response("Logged analytic");
  };
  ```

### Interact with your Analytics Engine binding locally

You cannot use an Analytics Engine binding locally.

## Environment variables

An [environment variable](https://developers.cloudflare.com/workers/configuration/environment-variables/) is an injected value that can be accessed by your Functions. Environment variables are a type of binding that allow you to attach text strings or JSON values to your Pages Function. It is stored as plain text. Set your environment variables directly within the Cloudflare dashboard for both your production and preview environments at runtime and build-time.

To add environment variables to your Pages project, you can use the [Wrangler configuration file](https://developers.cloudflare.com/pages/functions/wrangler-configuration/#environment-variables) or the Cloudflare dashboard.

To configure an environment variable via the Cloudflare dashboard:

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com) and select your account.
2. In **Account Home**, select **Workers & Pages**.
3. Select your Pages project > **Settings**.
4. Select your Pages environment > **Variables and Secrets** > **Add** .
5. After setting a variable name and value, select **Save**.

Below is an example of how to use environment variables in your Function. The environment variable in this example is `ENVIRONMENT` and you can access the environment variable on `context.env`:

* JavaScript

  ```js
  export function onRequest(context) {
    if (context.env.ENVIRONMENT === "development") {
      return new Response("This is a local environment!");
    } else {
      return new Response("This is a live environment");
    }
  }
  ```

* TypeScript

  ```ts
  interface Env {
    ENVIRONMENT: string;
  }


  export const onRequest: PagesFunction<Env> = async (context) => {
    if (context.env.ENVIRONMENT === "development") {
      return new Response("This is a local environment!");
    } else {
      return new Response("This is a live environment");
    }
  };
  ```

### Interact with your environment variables locally

You can interact with your environment variables locally in one of two ways:

* Configure your Pages project's Wrangler file and running `npx wrangler pages dev`.
* Pass arguments to [`wrangler pages dev`](https://developers.cloudflare.com/workers/wrangler/commands/#dev-1) directly.

To interact with your environment variables locally via the Wrangler CLI, add `--binding=<ENVIRONMENT_VARIABLE_NAME>=<ENVIRONMENT_VARIABLE_VALUE>` to the `wrangler pages dev` command:

```sh
npx wrangler pages dev --binding=<ENVIRONMENT_VARIABLE_NAME>=<ENVIRONMENT_VARIABLE_VALUE>
```

## Secrets

Secrets are a type of binding that allow you to attach encrypted text values to your Pages Function. You cannot see secrets after you set them and can only access secrets programmatically on `context.env`. Secrets are used for storing sensitive information like API keys and auth tokens.

To add secrets to your Pages project:

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com) and select your account.
2. In **Account Home**, select **Workers & Pages**.
3. Select your Pages project > select **Settings**.
4. Select your Pages environment > **Variables and Secrets** > **Add**.
5. Set a variable name and value.
6. Select **Encrypt** to create your secret.
7. Select **Save**.

You use secrets the same way as environment variables. When setting secrets with Wrangler or in the Cloudflare dashboard, it needs to be done before a deployment that uses those secrets. For more guidance, refer to [Environment variables](#environment-variables).

### Local development with secrets

When developing your Worker or Pages Function, create a `.dev.vars` file in the root of your project to define secrets that will be used when running `wrangler dev` or `wrangler pages dev`, as opposed to using environment variables in the [Wrangler configuration file](https://developers.cloudflare.com/workers/configuration/environment-variables/#compare-secrets-and-environment-variables). This works both in local and remote development modes.

The `.dev.vars` file should be formatted like a `dotenv` file, such as `KEY="VALUE"`:

```bash
SECRET_KEY="value"
API_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
```

To set different secrets for each environment, create files named `.dev.vars.<environment-name>`. When you use `wrangler <command> --env <environment-name>`, the corresponding environment-specific file will be loaded instead of the `.dev.vars` file.

Like other environment variables, secrets are [non-inheritable](https://developers.cloudflare.com/workers/wrangler/configuration/#non-inheritable-keys) and must be defined per environment.

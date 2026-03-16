# Architecture Diagrams

This document provides a high-level overview of the application infrastructure and the CI/CD pipeline.

---

## 1. Infrastructure Diagram

The diagram below shows how the three AWS services interact to serve the application.

```
┌─────────────────────────────────────────────────────────────────┐
│                         User / Browser                          │
└────────────────────┬───────────────────────────┬────────────────┘
                     │  HTTP (port 80)            │  HTTP (port 80)
                     ▼                            ▼
        ┌────────────────────┐       ┌────────────────────────────┐
        │    AWS S3 Bucket   │       │  AWS Elastic Beanstalk     │
        │  (Static Website)  │       │  (Node/Express REST API)   │
        │                    │       │                            │
        │  Angular 18 SPA    │       │  /api/products             │
        │  index.html        │  ───► │  /api/users                │
        │  main.js           │       │  /api/orders               │
        │  styles.css        │       │  /api/cart                 │
        │  assets/           │       │  /api/auth                 │
        └────────────────────┘       └────────────┬───────────────┘
                                                  │
                                                  │ TCP port 5432
                                                  ▼
                                     ┌────────────────────────────┐
                                     │      AWS RDS               │
                                     │  (PostgreSQL 14)           │
                                     │                            │
                                     │  Tables:                   │
                                     │  • users                   │
                                     │  • products                │
                                     │  • orders                  │
                                     │  • order_products          │
                                     │  • cart_items              │
                                     │  • addresses               │
                                     │  • refresh_tokens          │
                                     └────────────────────────────┘
```

**Communication flow:**
1. User loads the Angular SPA from the S3 static website URL.
2. The Angular app makes REST API calls to the Elastic Beanstalk URL.
3. Elastic Beanstalk (Node/Express) queries the RDS PostgreSQL database.
4. RDS is not publicly accessible; it only accepts connections from the EB security group.

---

## 2. CI/CD Pipeline Diagram

The diagram below shows the CircleCI pipeline triggered on every push to GitHub.

```
┌─────────────────────────────────────────────────────────────────┐
│  Developer                                                      │
│  git push → GitHub (main branch)                                │
└──────────────────────────────┬──────────────────────────────────┘
                               │  Webhook
                               ▼
                    ┌──────────────────┐
                    │    CircleCI      │
                    │  (detects push)  │
                    └────────┬─────────┘
                             │  Spawns parallel jobs
              ┌──────────────┴──────────────┐
              ▼                             ▼
┌─────────────────────────┐   ┌─────────────────────────────┐
│  build-and-test-backend │   │  build-and-test-frontend    │
│                         │   │                             │
│  • npm install          │   │  • npm install              │
│  • tsc (compile TS)     │   │  • Set API URL from secret  │
│  • db-migrate up        │   │  • ng build --prod          │
│  • jasmine (7 suites)   │   │  • ng test (ChromeHeadless) │
│  • db-migrate reset     │   │  • Persist dist/ workspace  │
│                         │   │                             │
│  [Postgres 14 sidecar]  │   │  [Chrome headless browser]  │
└────────────┬────────────┘   └───────────────┬─────────────┘
             │ (tests pass)                   │ (tests pass)
             │ (main branch only)             │ (main branch only)
             ▼                               ▼
┌────────────────────────┐   ┌───────────────────────────────┐
│    deploy-backend      │   │      deploy-frontend          │
│                        │   │                               │
│  • Install EB CLI      │   │  • Attach dist/ workspace     │
│  • aws-cli/setup       │   │  • aws-cli/setup              │
│  • npm run build       │   │  • aws s3 sync dist/ → S3     │
│  • eb deploy           │   │                               │
│       │                │   │            │                  │
│       ▼                │   │            ▼                  │
│  AWS Elastic           │   │       AWS S3 Bucket           │
│  Beanstalk             │   │       (static website)        │
└────────────────────────┘   └───────────────────────────────┘
             │                              │
             └──────────────┬───────────────┘
                            ▼
                 ┌─────────────────────┐
                 │    AWS RDS          │
                 │  (pre-existing;     │
                 │   migrations run    │
                 │   via EB deploy)    │
                 └─────────────────────┘
```

**Key points:**
- Both build/test jobs run in **parallel** on every push to any branch.
- Deploy jobs run only on the **`main`** branch and only **after** their respective build/test job passes.
- All secrets (AWS keys, JWT secret, DB password, etc.) are stored in CircleCI as encrypted environment variables — never in source code.

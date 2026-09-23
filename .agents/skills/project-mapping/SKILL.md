---
name: project-mapping
description: Resolves project folders when the user mentions "Backend" or "Mobile". Use this skill whenever the user mentions "Backend" (which refers to card-workspace/card-api) or "Mobile" (which refers to card-workspace/card-mobile) to ensure commands, file searches, and code changes target the correct directory across any PC/environment.
---

# Project Mapping Skill

This skill defines the portable workspace project routing convention for multi-PC setups. The root workspace folder is always `card-workspace`. Within `card-workspace`, there are two subprojects: `card-api` (Backend) and `card-mobile` (Mobile).

> [!IMPORTANT]
> **Portability Rule**: Never hardcode machine-specific absolute paths (such as `/Users/...` or `C:\...`). Always resolve paths relative to the `card-workspace` root directory.

## Project Directory Mapping

| Mentioned Name | Relative Path from Workspace Root | Tech Stack | Description |
| :--- | :--- | :--- | :--- |
| **Backend** | `card-workspace/card-api` (`card-api/`) | NestJS 11, Prisma ORM, PostgreSQL, JWT Auth, TypeScript | REST API and backend services |
| **Mobile** | `card-workspace/card-mobile` (`card-mobile/`) | React Native 0.86, TypeScript, Redux Toolkit, React Navigation, Axios | iOS & Android mobile application |

---

## 1. Backend (`card-workspace/card-api`)

When the user mentions **"Backend"**, **"backend"**, **"API"**, **"server"**, or related backend services:

- **Target Folder**: `card-workspace/card-api` (or `card-api/` relative to `card-workspace`)
- **Framework & Libraries**:
  - NestJS 11 (`@nestjs/core`, `@nestjs/common`, `@nestjs/jwt`, `@nestjs/platform-express`)
  - Prisma ORM 6 with PostgreSQL (`@prisma/client`, `prisma`)
  - TypeScript 5.7+
  - Jest for testing
- **Key Directories & Files**:
  - `src/` — Main application logic:
    - `src/auth/` — Authentication & authorization (JWT, guards, login DTO)
    - `src/user/` — User management controller and service
    - `src/prisma/` — Prisma database module & service
    - `src/main.ts` — Application bootstrap entrypoint
    - `src/app.module.ts` — Root module
  - `prisma/` — Database schema (`schema.prisma`) and seed scripts
  - `package.json` — Backend dependencies and npm scripts
  - `.env` — Environment variables (`DATABASE_URL`, JWT secrets, etc.)
- **Operating Guidelines**:
  - Set working directory (`Cwd`) to the relative or active path of `card-api` inside `card-workspace`.
  - Common commands (run inside `card-api`):
    - `npm run start:dev` — Start NestJS in watch mode
    - `npm run build` — Build project
    - `npm run test` — Run unit tests
    - `npm run db:migrate` — Run Prisma migrations
    - `npm run db:studio` — Open Prisma Studio
    - `npm run lint` — Lint and fix backend code

---

## 2. Mobile (`card-workspace/card-mobile`)

When the user mentions **"Mobile"**, **"mobile"**, **"app"**, **"frontend"**, **"client"**, or mobile app features:

- **Target Folder**: `card-workspace/card-mobile` (or `card-mobile/` relative to `card-workspace`)
- **Framework & Libraries**:
  - React Native 0.86 with React 19
  - TypeScript 5.8+
  - State Management: Redux Toolkit (`@reduxjs/toolkit`, `react-redux`, `redux-persist`)
  - Navigation: React Navigation 7 (`@react-navigation/native`, `@react-navigation/native-stack`, `@react-navigation/bottom-tabs`)
  - HTTP Client: Axios
  - UI & Styling: `react-native-safe-area-context`, `react-native-screens`, `react-native-svg`, `react-native-vector-icons`, `react-native-linear-gradient`
  - Localization: `i18next`, `react-i18next`
- **Key Directories & Files**:
  - `App.tsx` — Main application component
  - `index.js` — React Native entry point
  - `src/` — Source code:
    - `src/screen/` — App screens
    - `src/components/` — Reusable UI components
    - `src/route/` — Navigation stacks and tabs
    - `src/redux/` — Redux slices and store configuration
    - `src/services/` — API calls and network services
    - `src/theme/` — Color palettes, typography, spacing
    - `src/hooks/` — Custom React hooks
    - `src/types/` — TypeScript interfaces and types
    - `src/utils/` — Helper utility functions
  - `ios/` & `android/` — Native platform projects
  - `package.json` — Mobile dependencies and npm scripts
- **Operating Guidelines**:
  - Set working directory (`Cwd`) to the relative or active path of `card-mobile` inside `card-workspace`.
  - Common commands (run inside `card-mobile`):
    - `npm run start` — Start Metro bundler
    - `npm run android` — Run on Android device/emulator
    - `npm run ios` — Run on iOS simulator/device
    - `npm test` — Run Jest tests
    - `npm run lint` — Lint mobile code

---

## 3. General Resolution Rules

1. **Portable Relative Paths**: Determine the absolute location of `card-workspace` dynamically from the active workspace environment. Never assume a specific home directory or machine user path.
2. **Explicit Project Reference**: If the user's prompt mentions "Backend" or "Mobile", restrict context, searches, edits, and terminal execution to the designated project folder (`card-workspace/card-api` or `card-workspace/card-mobile`).
3. **Dual or Full-Stack Mentions**: If the user asks for a feature spanning both (e.g. "Create an endpoint in Backend and call it in Mobile"), handle `card-api` for backend endpoints/database and `card-mobile` for API service integration and UI.
4. **Implicit Subject Matter**: If the user does not specify a name, infer based on domain: NestJS/Prisma/PostgreSQL implies `card-api`, while React Native/Redux/Mobile UI implies `card-mobile`.

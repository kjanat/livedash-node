# LiveDash-Node

A real-time analytics dashboard for monitoring user sessions and interactions with interactive data visualizations and detailed metrics.

![Next.js](<https://img.shields.io/badge/dynamic/regex?url=https%3A%2F%2Fraw.githubusercontent.com%2Fkjanat%2Flivedash-node%2Fmaster%2Fpackage.json&search=%22next%22%5Cs*%3A%5Cs*%22%5C%5E(%3F%3Cversion%3E%5Cd%2B%5C.%5Cd*).*%22&replace=%24%3Cversion%3E&logo=nextdotjs&label=Nextjs&color=%23000000>)
![React](<https://img.shields.io/badge/dynamic/regex?url=https%3A%2F%2Fraw.githubusercontent.com%2Fkjanat%2Flivedash-node%2Fmaster%2Fpackage.json&search=%22react%22%5Cs*%3A%5Cs*%22%5C%5E(%3F%3Cversion%3E%5Cd%2B%5C.%5Cd*).*%22&replace=%24%3Cversion%3E&logo=react&label=React&color=%2361DAFB>)
![TypeScript](<https://img.shields.io/badge/dynamic/regex?url=https%3A%2F%2Fraw.githubusercontent.com%2Fkjanat%2Flivedash-node%2Fmaster%2Fpackage.json&search=%22typescript%22%5Cs*%3A%5Cs*%22%5C%5E(%3F%3Cversion%3E%5Cd%2B%5C.%5Cd*).*%22&replace=%24%3Cversion%3E&logo=typescript&label=TypeScript&color=%233178C6>)
![Prisma](<https://img.shields.io/badge/dynamic/regex?url=https%3A%2F%2Fraw.githubusercontent.com%2Fkjanat%2Flivedash-node%2Fmaster%2Fpackage.json&search=%22prisma%22%5Cs*%3A%5Cs*%22%5C%5E(%3F%3Cversion%3E%5Cd%2B%5C.%5Cd*).*%22&replace=%24%3Cversion%3E&logo=prisma&label=Prisma&color=%232D3748>)
![TailwindCSS](<https://img.shields.io/badge/dynamic/regex?url=https%3A%2F%2Fraw.githubusercontent.com%2Fkjanat%2Flivedash-node%2Fmaster%2Fpackage.json&search=%22tailwindcss%22%5Cs*%3A%5Cs*%22%5C%5E(%3F%3Cversion%3E%5Cd%2B%5C.%5Cd*).*%22&replace=%24%3Cversion%3E&logo=tailwindcss&label=TailwindCSS&color=%2306B6D4>)

## Features

- **Real-time Session Monitoring**: Track and analyze user sessions as they happen
- **Interactive Visualizations**: Geographic maps, response time distributions, and more
- **Advanced Analytics**: Detailed metrics and insights about user behavior
- **User Management**: Secure authentication with role-based access control
- **Customizable Dashboard**: Filter and sort data based on your specific needs
- **Session Details**: In-depth analysis of individual user sessions

## Tech Stack

- **Frontend**: React 19, Next.js 15, TailwindCSS 4
- **Backend**: Next.js API Routes, Node.js
- **Database**: Prisma ORM with SQLite (default), compatible with PostgreSQL
- **Authentication**: NextAuth.js
- **Visualization**: Chart.js, D3.js, React Leaflet
- **Data Processing**: Node-cron for scheduled tasks

## Getting Started

### Prerequisites

- Node.js (LTS version recommended)
- npm or yarn

### Installation

1.  Clone this repository:

```bash
git clone https://github.com/kjanat/livedash-node.git
cd livedash-node
```

2.  Install dependencies:

```bash
npm install
```

3.  Set up the database:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

4.  Start the development server:

```bash
npm run dev
```

5.  Open your browser and navigate to <http://localhost:3000>

## Environment Setup

Create a `.env` file in the root directory with the following variables:

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here
```

## Project Structure

- `app/`: Next.js App Router components and pages
- `components/`: Reusable React components
- `lib/`: Utility functions and shared code
- `pages/`: API routes and server-side code
- `prisma/`: Database schema and migrations
- `public/`: Static assets
- `docs/`: Project documentation

## Available Scripts

- `npm run dev`: Start the development server
- `npm run build`: Build the application for production
- `npm run start`: Run the production build
- `npm run lint`: Run ESLint
- `npm run format`: Format code with Prettier
- `npm run prisma:studio`: Open Prisma Studio to view database

## Contributing

1.  Fork the repository
2.  Create your feature branch: `git checkout -b feature/my-new-feature`
3.  Commit your changes: `git commit -am 'Add some feature'`
4.  Push to the branch: `git push origin feature/my-new-feature`
5.  Submit a pull request

## License

This project is not licensed for commercial use without explicit permission. Free to use for educational or personal projects.

## Acknowledgments

- [Next.js](https://nextjs.org/)
- [Prisma](https://prisma.io/)
- [TailwindCSS](https://tailwindcss.com/)
- [Chart.js](https://www.chartjs.org/)
- [D3.js](https://d3js.org/)
- [React Leaflet](https://react-leaflet.js.org/)

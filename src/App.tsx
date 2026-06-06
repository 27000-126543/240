import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import Dashboard from "@/pages/Dashboard";
import TaskList from "@/pages/TaskList";
import TaskDetail from "@/pages/TaskDetail";
import CreateTask from "@/pages/CreateTask";
import Approval from "@/pages/Approval";
import Reports from "@/pages/Reports";
import Batches from "@/pages/Batches";
import Recommendation from "@/pages/Recommendation";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/tasks" element={<TaskList />} />
          <Route path="/tasks/create" element={<CreateTask />} />
          <Route path="/tasks/:taskId" element={<TaskDetail />} />
          <Route path="/approval" element={<Approval />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/batches" element={<Batches />} />
          <Route path="/recommendation" element={<Recommendation />} />
        </Route>
      </Routes>
    </Router>
  );
}

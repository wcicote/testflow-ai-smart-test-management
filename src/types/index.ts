export interface Project {
  id: string;
  name: string;
  description: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface TestCase {
  id: string;
  project_id: string;
  title: string;
  system_requirement: string | null;
  steps: string | null;
  expected_result: string | null;
  priority: 'low' | 'medium' | 'high';
  test_type: 'manual' | 'automated';
  status: 'draft' | 'ready' | 'running' | 'passed' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface TestExecution {
  id: string;
  test_case_id: string;
  status: 'passed' | 'failed';
  notes: string | null;
  bug_description: string | null;
  executed_by: string;
  created_at: string;
}

export interface Bug {
  id: string;
  bug_description: string;
  status: 'failed';
  created_at: string;
  test_case_id: string;
  test_case_title: string;
  project_id: string;
  project_name: string;
  priority: 'low' | 'medium' | 'high';
}

export interface DashboardStats {
  totalProjects: number;
  totalTests: number;
  activeBugs: number;
  successRate: number;
}

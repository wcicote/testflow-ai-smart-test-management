export interface Project {
  id: string;
  project_number: number;
  name: string;
  description: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface TestSuite {
  id: string;
  suite_number: number;
  project_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface TestCase {
  id: string;
  case_number: number;
  project_id: string;
  suite_id?: string | null;
  title: string;
  system_requirement: string | null;
  pre_conditions: string | null;
  data_setup: string | null;
  steps: string | null;
  expected_result: string | null;
  tags: string[];
  priority: 'low' | 'medium' | 'high';
  test_type: 'manual' | 'automated';
  status: 'draft' | 'ready' | 'running' | 'passed' | 'failed';
  automation_script: string | null;
  automation_framework: 'cypress' | 'playwright' | null;
  created_at: string;
  updated_at: string;
}

export interface TestExecution {
  id: string;
  execution_number: number;
  test_case_id: string;
  status: 'passed' | 'failed';
  notes: string | null;
  bug_description: string | null;
  executed_by: string;
  created_at: string;
}

export interface Bug {
  id: string;
  execution_number: number;
  bug_description: string;
  status: 'failed';
  bug_status: 'open' | 'in_progress' | 'resolved';
  created_at: string;
  test_case_id: string;
  test_case_title: string;
  test_case_steps: string | null;
  project_id: string;
  project_name: string;
  priority: 'low' | 'medium' | 'high';
  executed_by?: string;
  evidences?: BugEvidence[];
}


export interface BugEvidence {
  id: string;
  test_execution_id: string;
  file_url: string;
  file_type: 'image' | 'video';
  file_name: string;
  created_at: string;
}

export interface DashboardStats {
  totalProjects: number;
  totalTests: number;
  activeBugs: number;
  successRate: number;
}


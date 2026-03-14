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
  test_type: 'functional' | 'security' | 'performance' | 'usability';
  automation_status: 'manual' | 'automated' | 'hybrid';
  status: 'draft' | 'ready' | 'running' | 'passed' | 'failed';
  automation_script: string | null;
  automation_framework: 'cypress' | 'playwright' | null;
  origin: 'manual' | 'ai';
  created_at: string;
  updated_at: string;
}

export interface TestRun {
  id: string;
  run_number: number;
  project_id: string;
  suite_id?: string | null;
  name: string;
  status: 'running' | 'paused' | 'passed' | 'failed' | 'completed';
  current_step_index?: number;
  executed_by: string;
  test_suites?: { name: string };
  created_at: string;
  updated_at: string;
}

export interface TestExecution {
  id: string;
  execution_number: number;
  test_case_id: string;
  test_run_id?: string | null;
  status: 'passed' | 'failed' | 'blocked' | 'not_executed' | 'untested';
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
  aiTests: number;
  totalRuns: number;
}


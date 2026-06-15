import config from "../../config/departments";
import type { Department, DepartmentName, Idea } from "@/types";

export function isClubInitiative(idea: Idea): boolean {
  return idea.submissionType === "Club Initiative";
}

export function isInterdeptRequest(idea: Idea): boolean {
  return idea.submissionType === "Inter-dept Request";
}

export function getDepartment(name: DepartmentName): Department | undefined {
  return config.departments.find((d) => d.name === name);
}

export function getDeptLeadEmail(deptName: DepartmentName): string | undefined {
  return getDepartment(deptName)?.teamLeadEmail;
}

export function getSubmitterDeptHead(submitterDept: DepartmentName): Department | undefined {
  return config.departments.find((d) => d.name === submitterDept && !d.isStrategy);
}

export function getRoutingDepartments(idea: Idea): Department[] {
  if (isInterdeptRequest(idea)) {
    if (!idea.responsibleDepartment) return [];
    const dept = getDepartment(idea.responsibleDepartment);
    return dept ? [dept] : [];
  }
  return idea.departmentsNeeded
    .map((name) => getDepartment(name))
    .filter((d): d is Department => d !== undefined);
}

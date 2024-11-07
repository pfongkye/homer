import { mergeRequestApprovalsFixture } from '../__fixtures__/mergeRequestApprovalsFixture';
import { mergeRequestDetailsFixture } from '../__fixtures__/mergeRequestDetailsFixture';
import { mergeRequestFixture } from '../__fixtures__/mergeRequestFixture';
import { mergeRequestReviewersFixture } from '../__fixtures__/mergeRequestReviewersFixture';
import { projectFixture } from '../__fixtures__/projectFixture';
import { mockGitlabCall } from './mockGitlabCall';

export function mockBuildReviewMessageCalls() {
  const { iid, project_id, web_url } = mergeRequestFixture;

  const url = new URL(web_url);
  const projectPath = url.pathname
    .split('/')
    .filter(Boolean)
    .slice(0, -2)
    .join('/');

  mockGitlabCall(
    `/projects/${project_id}/merge_requests/${iid}/approvals`,
    mergeRequestApprovalsFixture
  );
  mockGitlabCall(
    `/projects/${project_id}/merge_requests/${iid}`,
    mergeRequestDetailsFixture
  );
  mockGitlabCall(
    `/projects/${encodeURIComponent(projectPath)}/merge_requests/${iid}`,
    mergeRequestDetailsFixture
  );
  mockGitlabCall(
    `/projects/${project_id}/merge_requests/${iid}/reviewers`,
    mergeRequestReviewersFixture
  );
  mockGitlabCall(`/projects/${project_id}`, projectFixture);
}

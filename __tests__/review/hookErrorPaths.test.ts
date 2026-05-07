import request from 'supertest';
import { app } from '@/app';
import { HTTP_STATUS_OK } from '@/constants';
import { addProjectToChannel, addReviewToChannel } from '@/core/services/data';
import { logger } from '@/core/services/logger';
import { slackBotWebClient } from '@/core/services/slack';
import { mergeRequestHookFixture } from '../__fixtures__/hooks/mergeRequestHookFixture';
import { pushHookFixture } from '../__fixtures__/hooks/pushHookFixture';
import { mergeRequestFixture } from '../__fixtures__/mergeRequestFixture';
import { mergeRequestNoteHookFixture } from '../__fixtures__/mergeRequestNoteBody';
import { projectFixture } from '../__fixtures__/projectFixture';
import { userDetailsFixture } from '../__fixtures__/userDetailsFixture';
import { getGitlabHeaders } from '../utils/getGitlabHeaders';
import { mockBuildReviewMessageCalls } from '../utils/mockBuildReviewMessageCalls';
import { mockGitlabCall } from '../utils/mockGitlabCall';
import { waitFor } from '../utils/waitFor';

describe('review > hook handlers > error paths', () => {
  beforeEach(() => {
    (slackBotWebClient.users.lookupByEmail as jest.Mock).mockImplementation(
      ({ email }: { email: string }) => {
        const name = email.split('@')[0];
        return Promise.resolve({
          user: {
            name,
            profile: { image_24: 'image_24', image_72: 'image_72' },
            real_name: `${name}.real`,
          },
        });
      },
    );
  });

  describe('noteHookHandler', () => {
    it('logs a structured error when chat.update rejects after the 200 ack', async () => {
      // Given
      const channelId = 'channelId';
      await addReviewToChannel({
        channelId,
        mergeRequestIid: mergeRequestFixture.iid,
        projectId: mergeRequestFixture.project_id,
        ts: 'ts',
      });
      mockBuildReviewMessageCalls();
      mockGitlabCall(
        `/users/${mergeRequestNoteHookFixture.object_attributes.author_id}`,
        userDetailsFixture,
      );
      (slackBotWebClient.chat.update as jest.Mock).mockRejectedValueOnce(
        new Error('rate_limited'),
      );
      jest.useFakeTimers();

      // When
      const response = await request(app)
        .post('/api/v1/homer/gitlab')
        .set(getGitlabHeaders())
        .send(mergeRequestNoteHookFixture);
      jest.runAllTimers();
      jest.useRealTimers();

      // Then
      expect(response.status).toEqual(HTTP_STATUS_OK);
      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith(
          expect.objectContaining({
            hook: 'note',
            mrIid: mergeRequestFixture.iid,
            projectId: mergeRequestFixture.project_id,
            err: expect.any(Error),
          }),
          'webhook slack work failed',
        );
      });
    });

    it('logs a structured error when chat.postMessage (debounced thread) rejects', async () => {
      // Given
      const channelId = 'channelId';
      await addReviewToChannel({
        channelId,
        mergeRequestIid: mergeRequestFixture.iid,
        projectId: mergeRequestFixture.project_id,
        ts: 'ts',
      });
      mockBuildReviewMessageCalls();
      mockGitlabCall(
        `/users/${mergeRequestNoteHookFixture.object_attributes.author_id}`,
        userDetailsFixture,
      );
      (slackBotWebClient.chat.postMessage as jest.Mock).mockRejectedValueOnce(
        new Error('service_unavailable'),
      );
      jest.useFakeTimers();

      // When
      const response = await request(app)
        .post('/api/v1/homer/gitlab')
        .set(getGitlabHeaders())
        .send(mergeRequestNoteHookFixture);
      jest.runAllTimers();
      jest.useRealTimers();

      // Then
      expect(response.status).toEqual(HTTP_STATUS_OK);
      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith(
          expect.objectContaining({
            hook: 'note',
            mrIid: mergeRequestFixture.iid,
            projectId: mergeRequestFixture.project_id,
            err: expect.any(Error),
          }),
          'webhook slack work failed',
        );
      });
    });
  });

  describe('mergeRequestHookHandler', () => {
    it('logs a structured error when chat.update rejects on the existing-review branch', async () => {
      // Given
      const { object_attributes, project } = mergeRequestHookFixture;
      const channelId = 'channelId';
      await addReviewToChannel({
        channelId,
        mergeRequestIid: object_attributes.iid,
        projectId: project.id,
        ts: 'ts',
      });
      mockBuildReviewMessageCalls();
      (slackBotWebClient.chat.update as jest.Mock).mockRejectedValueOnce(
        new Error('rate_limited'),
      );

      // When
      const response = await request(app)
        .post('/api/v1/homer/gitlab')
        .set(getGitlabHeaders())
        .send({
          ...mergeRequestHookFixture,
          object_attributes: { ...object_attributes, action: 'approved' },
        });

      // Then
      expect(response.status).toEqual(HTTP_STATUS_OK);
      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith(
          expect.objectContaining({
            hook: 'merge_request',
            mrIid: object_attributes.iid,
            projectId: project.id,
            err: expect.any(Error),
          }),
          'webhook slack work failed',
        );
      });
    });

    it('logs a structured error when chat.postMessage rejects in handleNewReview', async () => {
      // Given
      const { object_attributes } = mergeRequestHookFixture;
      const channelId = 'channelId';
      await addProjectToChannel({ channelId, projectId: projectFixture.id });
      mockBuildReviewMessageCalls();
      (slackBotWebClient.chat.postMessage as jest.Mock).mockRejectedValueOnce(
        new Error('rate_limited'),
      );

      // When
      const response = await request(app)
        .post('/api/v1/homer/gitlab')
        .set(getGitlabHeaders())
        .send({
          ...mergeRequestHookFixture,
          labels: [{ title: 'homer-review' }],
          object_attributes: { ...object_attributes, action: 'open' },
        });

      // Then
      expect(response.status).toEqual(HTTP_STATUS_OK);
      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith(
          expect.objectContaining({
            hook: 'merge_request',
            mrIid: object_attributes.iid,
            projectId: projectFixture.id,
            err: expect.any(Error),
          }),
          'webhook slack work failed',
        );
      });
    });
  });

  describe('pushHookHandler', () => {
    it('logs a structured error when chat.postMessage (new commits) rejects', async () => {
      // Given
      const branchName = 'master';
      const channelId = 'channelId';
      mockGitlabCall(
        `/projects/${pushHookFixture.project_id}/merge_requests?source_branch=${branchName}`,
        [mergeRequestFixture],
      );
      mockGitlabCall(
        `/projects/${pushHookFixture.project_id}/merge_requests/${mergeRequestFixture.iid}/commits?per_page=100`,
        [{ id: pushHookFixture.commits[1].id }],
      );
      await addReviewToChannel({
        channelId,
        mergeRequestIid: mergeRequestFixture.iid,
        projectId: mergeRequestFixture.project_id,
        ts: 'ts',
      });
      (slackBotWebClient.chat.postMessage as jest.Mock).mockRejectedValueOnce(
        new Error('rate_limited'),
      );

      // When
      const response = await request(app)
        .post('/api/v1/homer/gitlab')
        .set(getGitlabHeaders())
        .send(pushHookFixture);

      // Then
      expect(response.status).toEqual(HTTP_STATUS_OK);
      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith(
          expect.objectContaining({
            hook: 'push',
            mrIid: mergeRequestFixture.iid,
            projectId: pushHookFixture.project_id,
            err: expect.any(Error),
          }),
          'webhook slack work failed',
        );
      });
    });
  });
});

import { describe, expect, it } from 'vitest'
import { shouldPromptForTeamSelection } from './team-scope.js'

const teams = [
  { id: 'team-a', name: 'Team A' },
  { id: 'team-b', name: 'Team B' },
]

describe('shouldPromptForTeamSelection', () => {
  it('prompts multi-team users when no active team is available even if remembering is enabled', () => {
    expect(
      shouldPromptForTeamSelection({
        hasClubAccess: true,
        teams,
        activeTeamId: null,
        rememberLastTeam: true,
      }),
    ).toBe(true)
  })

  it('prompts multi-team users on login when remember-last-team is disabled', () => {
    expect(
      shouldPromptForTeamSelection({
        hasClubAccess: true,
        teams,
        activeTeamId: 'team-a',
        rememberLastTeam: false,
      }),
    ).toBe(true)
  })

  it('skips the picker when a remembered active team is valid', () => {
    expect(
      shouldPromptForTeamSelection({
        hasClubAccess: true,
        teams,
        activeTeamId: 'team-a',
        rememberLastTeam: true,
      }),
    ).toBe(false)
  })

  it('does not prompt users who are not in a multi-team club context', () => {
    expect(
      shouldPromptForTeamSelection({
        hasClubAccess: true,
        teams: [teams[0]],
        activeTeamId: 'team-a',
        rememberLastTeam: false,
      }),
    ).toBe(false)

    expect(
      shouldPromptForTeamSelection({
        hasClubAccess: false,
        teams,
        activeTeamId: null,
        rememberLastTeam: false,
      }),
    ).toBe(false)
  })
})

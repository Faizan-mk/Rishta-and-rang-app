import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../__tests__/testWrappers';
import {
  IntroMediaSection,
  MidProfilePhoto,
  SimilaritiesSection,
  ReadinessSection,
  AboutMeSection,
  FaithSection,
  FuturePlansSection,
  InterestsSection,
  PersonalitySection,
  EducationCareerSection,
  LanguagesBackgroundSection,
  BioSection,
  VerificationSection,
} from '../ProfileDetailSections';
import type { BrowseProfile } from '../../../types/content';

jest.mock('expo-audio', () => ({
  useAudioPlayer: jest.fn(() => ({ pause: jest.fn(), play: jest.fn() })),
  useAudioPlayerStatus: jest.fn(() => ({ playing: false, duration: 12 })),
}));
jest.mock('expo-video', () => ({
  useVideoPlayer: jest.fn(() => ({ playing: false, play: jest.fn(), pause: jest.fn() })),
  VideoView: () => null,
}));
jest.mock('expo', () => ({ useEvent: jest.fn(() => ({ isPlaying: false })) }));

function profile(overrides: Partial<BrowseProfile> = {}): BrowseProfile {
  return {
    id: 'p1',
    name: 'Sara',
    age: 27,
    gender: 'female',
    city: 'Lahore',
    photos: ['a.jpg', 'b.jpg', 'c.jpg'],
    ...overrides,
  };
}

describe('IntroMediaSection', () => {
  it('renders nothing without a voice or video intro', () => {
    const { toJSON } = renderWithProviders(<IntroMediaSection profile={profile()} />);
    expect(toJSON()).toBeNull();
  });

  it('renders the voice card with its duration', () => {
    renderWithProviders(<IntroMediaSection profile={profile({ voiceIntroUri: 'a.m4a', voiceIntroDurationSec: 65 })} />);
    expect(screen.getByText('1:05')).toBeTruthy();
  });

  it('toggles voice playback when the play button is pressed', () => {
    const { useAudioPlayer } = require('expo-audio');
    const play = jest.fn();
    useAudioPlayer.mockReturnValue({ pause: jest.fn(), play });
    renderWithProviders(<IntroMediaSection profile={profile({ voiceIntroUri: 'a.m4a', voiceIntroDurationSec: 10 })} />);
    fireEvent.press(screen.UNSAFE_getByProps({ name: 'play' }));
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('renders a video intro', () => {
    renderWithProviders(<IntroMediaSection profile={profile({ videoIntroUri: 'v.mp4' })} />);
    expect(screen.getByText('Voice & video intro')).toBeTruthy();
  });
});

describe('MidProfilePhoto', () => {
  it('renders nothing without a second photo', () => {
    const { toJSON } = renderWithProviders(<MidProfilePhoto photos={['only.jpg']} />);
    expect(toJSON()).toBeNull();
  });

  it('shows the photo count badge', () => {
    renderWithProviders(<MidProfilePhoto photos={['a.jpg', 'b.jpg', 'c.jpg']} />);
    expect(screen.getByText('2 / 3')).toBeTruthy();
  });

  it('calls onPress with the second photo', () => {
    const onPress = jest.fn();
    renderWithProviders(<MidProfilePhoto photos={['a.jpg', 'b.jpg']} onPress={onPress} />);
    fireEvent.press(screen.getByText('2 / 2'));
    expect(onPress).toHaveBeenCalledWith('b.jpg');
  });
});

describe('SimilaritiesSection', () => {
  it('shows the empty message with no shared items', () => {
    renderWithProviders(<SimilaritiesSection name="Sara" items={[]} />);
    expect(screen.getByText(/Nothing in common yet/)).toBeTruthy();
  });

  it('shows the shared items and the subtitle with the name', () => {
    renderWithProviders(<SimilaritiesSection name="Sara" items={['Coffee', 'Travel']} />);
    expect(screen.getByText('You and Sara already have some things in common.')).toBeTruthy();
    expect(screen.getByText('Coffee')).toBeTruthy();
    expect(screen.getByText('Travel')).toBeTruthy();
  });
});

describe('ReadinessSection', () => {
  it('renders nothing without a readiness value', () => {
    const { toJSON } = renderWithProviders(<ReadinessSection profile={profile()} />);
    expect(toJSON()).toBeNull();
  });

  it('shows the readiness caption with the name', () => {
    renderWithProviders(<ReadinessSection profile={profile({ readiness: 'ready_now' })} />);
    expect(screen.getByText("Where Sara is in their marriage journey right now.")).toBeTruthy();
  });

  it('shows the relocate chip when open to relocate', () => {
    renderWithProviders(<ReadinessSection profile={profile({ readiness: 'browsing', openToRelocate: true })} />);
    expect(screen.getByText('Open to relocate')).toBeTruthy();
  });
});

describe('AboutMeSection', () => {
  it('renders nothing with no about-me fields', () => {
    const { toJSON } = renderWithProviders(<AboutMeSection profile={profile()} />);
    expect(toJSON()).toBeNull();
  });

  it('shows height, marital status, children and occupation chips', () => {
    renderWithProviders(
      <AboutMeSection profile={profile({ heightCm: 170, maritalStatus: 'single', hasChildren: false, occupation: 'Doctor' })} />
    );
    expect(screen.getByText('170 cm')).toBeTruthy();
    expect(screen.getByText('Single')).toBeTruthy();
    expect(screen.getByText('No children')).toBeTruthy();
    expect(screen.getByText('Doctor')).toBeTruthy();
  });
});

describe('FaithSection', () => {
  it('renders nothing with no faith fields', () => {
    const { toJSON } = renderWithProviders(<FaithSection profile={profile()} />);
    expect(toJSON()).toBeNull();
  });

  it('shows religion, sect, practising and halal chips', () => {
    renderWithProviders(<FaithSection profile={profile({ religion: 'Islam', sect: 'Sunni', practising: true, halalOnly: true })} />);
    expect(screen.getByText('Islam')).toBeTruthy();
    expect(screen.getByText('Sunni')).toBeTruthy();
    expect(screen.getByText('Practising')).toBeTruthy();
    expect(screen.getByText('Only eats halal food')).toBeTruthy();
  });

  it('shows the non-smoker and drinks chips from explicit false/true values', () => {
    renderWithProviders(<FaithSection profile={profile({ smoking: false, drinking: true })} />);
    expect(screen.getByText('Non-smoker')).toBeTruthy();
    expect(screen.getByText('Drinks')).toBeTruthy();
  });
});

describe('FuturePlansSection', () => {
  it('renders nothing with no future-plans fields', () => {
    const { toJSON } = renderWithProviders(<FuturePlansSection profile={profile()} />);
    expect(toJSON()).toBeNull();
  });

  it('shows relocate, preferred country and career-plans chips', () => {
    renderWithProviders(
      <FuturePlansSection profile={profile({ openToRelocate: true, preferredCountry: 'Canada', careerPlans: 'Own a clinic' })} />
    );
    expect(screen.getByText('Open to relocate')).toBeTruthy();
    expect(screen.getByText('Canada')).toBeTruthy();
    expect(screen.getByText('Own a clinic')).toBeTruthy();
  });

  it('shows "No children" only when hasChildren is explicitly false', () => {
    renderWithProviders(<FuturePlansSection profile={profile({ hasChildren: false })} />);
    expect(screen.getByText('No children')).toBeTruthy();
  });
});

describe('InterestsSection', () => {
  it('renders nothing with no interests or vibe tags', () => {
    const { toJSON } = renderWithProviders(<InterestsSection profile={profile()} />);
    expect(toJSON()).toBeNull();
  });

  it('renders interests when present', () => {
    renderWithProviders(<InterestsSection profile={profile({ interests: ['Hiking'] })} />);
    expect(screen.getByText('Hiking')).toBeTruthy();
  });

  it('falls back to vibeTags when interests is absent', () => {
    renderWithProviders(<InterestsSection profile={profile({ vibeTags: ['Coffee'] })} />);
    expect(screen.getByText('Coffee')).toBeTruthy();
  });
});

describe('PersonalitySection', () => {
  it('renders nothing with no personality traits', () => {
    const { toJSON } = renderWithProviders(<PersonalitySection profile={profile()} />);
    expect(toJSON()).toBeNull();
  });

  it('renders personality traits', () => {
    renderWithProviders(<PersonalitySection profile={profile({ personality: ['Introvert'] })} />);
    expect(screen.getByText('Introvert')).toBeTruthy();
  });
});

describe('EducationCareerSection', () => {
  it('renders nothing with no education/career fields', () => {
    const { toJSON } = renderWithProviders(<EducationCareerSection profile={profile()} />);
    expect(toJSON()).toBeNull();
  });

  it('shows education, degree, job title and industry chips', () => {
    renderWithProviders(
      <EducationCareerSection profile={profile({ education: "Bachelor's", jobTitle: 'Engineer', industry: 'Technology' })} />
    );
    expect(screen.getByText("Bachelor's")).toBeTruthy();
    expect(screen.getByText('Engineer')).toBeTruthy();
    expect(screen.getByText('Technology')).toBeTruthy();
  });
});

describe('LanguagesBackgroundSection', () => {
  it('renders nothing with no languages/background fields', () => {
    const { toJSON } = renderWithProviders(<LanguagesBackgroundSection profile={profile()} />);
    expect(toJSON()).toBeNull();
  });

  it('shows languages, nationality and grew-up-in chips', () => {
    renderWithProviders(
      <LanguagesBackgroundSection profile={profile({ languages: ['Urdu'], nationality: 'Pakistani', grewUpIn: 'Karachi' })} />
    );
    expect(screen.getByText('Urdu')).toBeTruthy();
    expect(screen.getByText('Pakistani')).toBeTruthy();
    expect(screen.getByText('Grew up in Karachi')).toBeTruthy();
  });
});

describe('BioSection', () => {
  it('renders nothing with no bio or family background', () => {
    const { toJSON } = renderWithProviders(<BioSection profile={profile()} />);
    expect(toJSON()).toBeNull();
  });

  it('joins bio and family background with a blank line', () => {
    renderWithProviders(<BioSection profile={profile({ bio: 'I love hiking.', familyBackground: 'Small, close family.' })} />);
    expect(screen.getByText('I love hiking.\n\nSmall, close family.')).toBeTruthy();
  });
});

describe('VerificationSection', () => {
  it('shows the pending state when there is no selfie photo', () => {
    renderWithProviders(<VerificationSection profile={profile({ selfieVerified: false })} />);
    expect(screen.getByText("Sara hasn't added a main photo yet.")).toBeTruthy();
  });

  it('shows the done state once a selfie photo exists', () => {
    renderWithProviders(<VerificationSection profile={profile({ selfieVerified: true })} />);
    expect(screen.getByText('Sara has added a main photo.')).toBeTruthy();
  });
});

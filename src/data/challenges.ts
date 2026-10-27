import type { Challenge } from '../geometry/types';

export const CHALLENGES: Challenge[] = [
  {
    id: 'cube-net-valid',
    type: 'valid-net',
    solidId: 'cube',
    netId: 'cube-net-01',
    promptKo: '이 전개도는 정육면체로 접을 수 있을까요?',
    hintKo: '면의 개수와 이어진 모양을 먼저 세어 보세요.',
    options: ['접을 수 있어요', '접을 수 없어요'],
    answer: '접을 수 있어요',
    explanationKo:
      '여섯 개의 정사각형이 모두 한 줄로 이어져 있고, 겹치는 면이 없어요. 접으면 정육면체의 여섯 면이 정확히 한 번씩 채워져요.',
    difficulty: 1,
  },
  {
    id: 'cube-net-invalid',
    type: 'valid-net',
    solidId: 'cube',
    netId: 'cube-invalid-missing',
    promptKo: '이 전개도는 정육면체로 접을 수 있을까요?',
    hintKo: '정육면체에 필요한 면의 개수를 떠올려 보세요.',
    options: ['접을 수 있어요', '접을 수 없어요'],
    answer: '접을 수 없어요',
    explanationKo:
      '정육면체는 여섯 면이 필요해요. 이 전개도에는 다섯 면만 있어서 한 면이 비어 버려요.',
    difficulty: 2,
  },
  {
    id: 'pyramid-identify',
    type: 'identify-solid',
    solidId: 'square-pyramid',
    netId: 'square-pyramid-net-01',
    promptKo: '이 전개도를 접으면 어떤 입체가 될까요?',
    hintKo: '밑면이 정사각형이고, 옆면이 삼각형인지 살펴보세요.',
    options: ['정육면체', '정사각뿔', '삼각기둥', '정사면체'],
    answer: '정사각뿔',
    explanationKo:
      '정사각형 밑면 하나와 합동인 삼각형 네 개가 이어져 있어요. 접으면 꼭짓점 하나에서 네 옆면이 모이는 정사각뿔이 돼요.',
    difficulty: 1,
  },
  {
    id: 'tetra-identify',
    type: 'identify-solid',
    solidId: 'tetrahedron',
    netId: 'tetrahedron-net-01',
    promptKo: '이 전개도를 접으면 어떤 입체가 될까요?',
    hintKo: '모든 면이 어떤 모양인지 확인해 보세요.',
    options: ['정육면체', '정사각뿔', '삼각기둥', '정사면체'],
    answer: '정사면체',
    explanationKo:
      '합동인 정삼각형 네 개가 이어져 있어요. 접으면 네 면이 모두 삼각형인 정사면체가 돼요.',
    difficulty: 2,
  },
  {
    id: 'cube-section-square',
    type: 'cross-section',
    solidId: 'cube',
    section: { normal: { x: 0, y: 1, z: 0 }, offset: 0, labelKo: '가로 절단면' },
    promptKo: '정육면체를 가로로 반쯤 잘랐어요. 단면은 어떤 모양일까요?',
    hintKo: '절단면이 어느 면과 평행한지 생각해 보세요.',
    options: ['정사각형', '직사각형', '삼각형', '정육각형'],
    answer: '정사각형',
    explanationKo:
      '절단면이 정육면체의 윗면과 평행해요. 그래서 잘린 단면은 윗면과 같은 정사각형이 돼요.',
    difficulty: 2,
  },
  {
    id: 'cube-section-hexagon',
    type: 'cross-section',
    solidId: 'cube',
    section: { normal: { x: 1, y: 1, z: 1 }, offset: 0, labelKo: '대각선 절단면' },
    promptKo: '정육면체를 마주 보는 꼭짓점을 지나도록 비스듬히 잘랐어요. 단면은 어떤 모양일까요?',
    hintKo: '절단면이 여섯 개의 모서리를 지나가요.',
    options: ['정사각형', '오각형', '정육각형', '정삼각형'],
    answer: '정육각형',
    explanationKo:
      '절단면이 정육면체의 여섯 모서리를 모두 지나가요. 여섯 변의 길이가 같은 정육각형이 만들어져요.',
    difficulty: 3,
  },
  {
    id: 'cube-measure-area',
    type: 'measure',
    solidId: 'cube',
    promptKo: '한 모서리가 1인 정육면체의 겉넓이는 얼마일까요?',
    hintKo: '정사각형 한 면의 넓이를 구한 뒤 여섯 배 해 보세요.',
    options: ['1', '3', '6', '12'],
    answer: '6',
    explanationKo: '한 면의 넓이는 1 × 1 = 1이고, 같은 면이 여섯 개이므로 6 × 1 = 6이에요.',
    difficulty: 1,
  },
  {
    id: 'pyramid-measure-volume',
    type: 'measure',
    solidId: 'square-pyramid',
    promptKo: '밑면의 한 변이 2, 높이가 2인 정사각뿔의 부피는 얼마일까요?',
    hintKo: '뿔의 부피는 기둥의 부피의 3분의 1이에요.',
    options: ['1.33', '2.67', '4', '8'],
    answer: '2.67',
    explanationKo: '밑넓이는 2 × 2 = 4이고, 부피는 ⅓ × 4 × 2 = 8/3 ≈ 2.67이에요.',
    difficulty: 3,
  },
];

export const CHALLENGE_BY_ID = new Map(CHALLENGES.map((challenge) => [challenge.id, challenge]));

export function challengesForFilter(filter: 'all' | 'basic' | 'advanced'): Challenge[] {
  if (filter === 'basic') return CHALLENGES.filter((challenge) => challenge.difficulty <= 2);
  if (filter === 'advanced') return CHALLENGES.filter((challenge) => challenge.difficulty === 3);
  return CHALLENGES;
}

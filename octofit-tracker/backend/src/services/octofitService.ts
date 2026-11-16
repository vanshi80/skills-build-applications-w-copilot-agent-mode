import { Activity, Team, User, Workout } from '../models/index.js';

export async function listActivities() {
  return Activity.find().lean();
}

export async function createActivity(_input: unknown) {
  if (!_input || typeof _input !== 'object' || Array.isArray(_input)) {
    throw Object.assign(new Error('Activity input must be an object'), { status: 400 });
  }

  const input = _input as Record<string, unknown>;
  const { userId, teamId, type, minutes } = input;
  if (
    typeof userId !== 'string' ||
    !/^[a-f\d]{24}$/i.test(userId) ||
    typeof teamId !== 'string' ||
    !/^[a-f\d]{24}$/i.test(teamId) ||
    typeof type !== 'string' ||
    !type.trim() ||
    typeof minutes !== 'number' ||
    !Number.isFinite(minutes) ||
    minutes <= 0
  ) {
    throw Object.assign(new Error('Activity requires valid userId, teamId, type, and positive minutes'), { status: 400 });
  }

  const [user, team] = await Promise.all([User.exists({ _id: userId }), Team.exists({ _id: teamId })]);
  if (!user || !team) {
    throw Object.assign(new Error('Activity user or team was not found'), { status: 404 });
  }

  return Activity.create({
    user: userId,
    team: teamId,
    type: type.trim(),
    minutes,
    points: minutes,
    occurredAt: new Date(),
  });
}

export async function listTeams() {
  return Team.find().lean();
}

export async function createTeam(_input: unknown) {
  if (!_input || typeof _input !== 'object' || Array.isArray(_input)) {
    throw Object.assign(new Error('Team input must be an object'), { status: 400 });
  }

  const input = _input as Record<string, unknown>;
  const { name, mascot } = input;
  const rawMembers = input.members ?? [];
  if (
    typeof name !== 'string' ||
    !name.trim() ||
    typeof mascot !== 'string' ||
    !mascot.trim() ||
    !Array.isArray(rawMembers) ||
    rawMembers.some((member: unknown) => typeof member !== 'string' || !/^[a-f\d]{24}$/i.test(member))
  ) {
    throw Object.assign(new Error('Team requires a name, mascot, and valid member IDs'), { status: 400 });
  }

  const memberIds = rawMembers.filter((member): member is string => typeof member === 'string');
  if (memberIds.length > 0) {
    const existingMembers = await User.countDocuments({ _id: { $in: memberIds } });
    if (existingMembers !== new Set(memberIds).size) {
      throw Object.assign(new Error('One or more team members were not found'), { status: 404 });
    }
  }

  return Team.create({ name: name.trim(), mascot: mascot.trim(), members: memberIds });
}

export async function getLeaderboard() {
  const teams = await Activity.aggregate<{ teamName: string; totalPoints: number }>([
    { $group: { _id: '$team', totalPoints: { $sum: '$points' } } },
    {
      $lookup: {
        from: Team.collection.name,
        localField: '_id',
        foreignField: '_id',
        as: 'team',
      },
    },
    { $unwind: '$team' },
    { $project: { _id: 0, teamName: '$team.name', totalPoints: 1 } },
    { $sort: { totalPoints: -1, teamName: 1 } },
  ]);
  return teams.map((team, index) => ({ ...team, rank: index + 1 }));
}

export async function suggestWorkouts(_userEmail: string) {
  const user = await User.findOne({ email: _userEmail }).select('fitnessGoal').lean();
  if (!user) {
    throw Object.assign(new Error('User was not found'), { status: 404 });
  }

  const activity = await Activity.findOne({ user: user._id })
    .sort({ occurredAt: -1 })
    .select('type')
    .lean();
  const activityFocus = activity
    ? ['run', 'cycle', 'walk'].includes(activity.type) ? 'endurance' : activity.type
    : undefined;
  const workouts = await Workout.find().sort({ title: 1 }).lean();
  const preferredFocus = activityFocus ?? user.fitnessGoal;
  const matchingWorkouts = workouts.filter((workout) => workout.focus === preferredFocus);
  const goalWorkouts = workouts.filter((workout) => workout.focus === user.fitnessGoal);
  const suggestions = matchingWorkouts.length > 0
    ? matchingWorkouts
    : goalWorkouts.length > 0
      ? goalWorkouts
      : workouts;
  const reason = activity
    ? `Recommended for your recent ${activity.type} activity and ${user.fitnessGoal} goal.`
    : `Recommended for your ${user.fitnessGoal} goal.`;
  return suggestions.map((workout) => ({ ...workout, reason }));
}

export { User };

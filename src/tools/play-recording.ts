import { playSessionRecordingFromFile } from '../recordings/playback.js';

async function main() {
  const USAGE_MESSAGE = 'Usage: node dist/tools/play-recording.js <recording.ndjson> [--timed]';
  const args = process.argv.slice(2);
  const filePath = args.find((arg) => !arg.startsWith('--'));
  if (!filePath) {
    console.error(USAGE_MESSAGE);
    process.exit(1);
  }

  const timed = args.includes('--timed');
  const { recording, state } = await playSessionRecordingFromFile(filePath, { respectTiming: timed });

  const summary = {
    meta: recording.meta,
    processedEvents: state.processedEvents,
    agents: state.agents.map((agent) => ({
      id: agent.id,
      status: agent.status,
      sessionStatus: agent.sessionStatus,
      provider: agent.provider,
      model: agent.model,
      requestedExecutionMode: agent.requestedExecutionMode,
      resolvedExecutionMode: agent.resolvedExecutionMode,
      outputChunks: agent.outputs.length,
      outputText: agent.outputs.join(''),
      agentMessages: agent.agentMessages,
    })),
    conversations: state.conversations.map((conversation) => ({
      id: conversation.id,
      status: conversation.status,
      topic: conversation.topic,
      transcriptLength: conversation.transcript.length,
    })),
    teams: state.teams,
    teamTasks: state.teamTasks,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error('Failed to play recording:', err);
  process.exit(1);
});

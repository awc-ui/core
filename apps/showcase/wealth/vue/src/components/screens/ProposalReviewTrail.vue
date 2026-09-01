<!--
  One proposal's five stages, read-only.

  The fixture's `StepState` and `md-step`'s own four states are not the same
  four — a `current` stage is the component's `active` and a `blocked` one is
  its `error` — so the mapping goes through the kit's `stepState` and never
  through a ternary here.

  `:key="proposal.id"` is what makes this a readout rather than a control.
  `active` is authored once per proposal; because the value only changes when
  the key does, Vue never patches the attribute afterwards, so clicking a
  stage header moves the stepper's own highlight without the framework
  fighting it back. `auto-complete="false"` keeps the fixture's completion
  authoritative. `readonly` — this trail REPORTS where the proposal is; it
  does not move it. `nav={false}` alone only hid the Back / Continue bar and
  left every header a button, so the five stages invited a click that did
  nothing. `mode` is gone with it: a trail has no navigation, so there is no
  linear-vs-non-linear question left to answer.
-->
<script setup lang="ts">
import { stepState, type Proposal } from '@awc-ui/showcase-kit/wealth';
import { useCopy } from './proposal-copy';
import EmptyState from '~/components/EmptyState.vue';
import Panel from '~/components/Panel.vue';
import DateText from '~/components/bits/DateText.vue';
import Fact from '~/components/bits/Fact.vue';
import Money from '~/components/bits/Money.vue';
import Num from '~/components/bits/Num.vue';
import ProposalStatusChip from '~/components/bits/ProposalStatusChip.vue';
import ProposalTypeChip from '~/components/bits/ProposalTypeChip.vue';

defineProps<{ proposal: Proposal | undefined }>();

const c = useCopy();
</script>

<template>
  <Panel
    v-if="!proposal"
    :title="c('wealth.proposal.trail.title')"
    :subtitle="c('wealth.proposal.trail.hint')"
  >
    <EmptyState :message="c('wealth.proposal.trail.pick')" />
  </Panel>

  <Panel
    v-else
    :title="c('wealth.proposal.trail.title')"
    :subtitle="c('wealth.proposal.trail.hint')"
  >
    <template #actions>
      <ProposalStatusChip :status="proposal.status" />
    </template>

    <div class="stack">
      <md-stepper
        :key="proposal.id"
        :active="proposal.currentStepIndex"
        :nav="false"
        readonly
        :auto-complete="false"
        :label="c('wealth.proposal.trail.label', { id: proposal.id })"
        :step-word="c('wealth.proposal.stepper.step')"
        :of-word="c('wealth.proposal.stepper.of')"
        :completed-word="c('wealth.proposal.stepper.completed')"
        :current-word="c('wealth.proposal.stepper.current')"
        :error-word="c('wealth.proposal.stepper.error')"
        :optional-word="c('wealth.proposal.stepper.optional')"
      >
        <md-step
          v-for="step in proposal.steps"
          :key="step.id"
          :label="c(step.nameKey)"
          :description="c(step.stateKey)"
          :completed="stepState[step.state] === 'complete'"
          :error="stepState[step.state] === 'error'"
          :error-text="stepState[step.state] === 'error' ? c(step.stateKey) : ''"
        ></md-step>
      </md-stepper>

      <dl class="dl">
        <Fact :label="c('wealth.table.id')">{{ proposal.id }}</Fact>
        <Fact :label="c('wealth.table.household')">{{ proposal.householdName }}</Fact>
        <Fact :label="c('wealth.table.type')">
          <ProposalTypeChip :type="proposal.type" />
        </Fact>
        <Fact :label="c('wealth.table.estimatedValue')">
          <Money :value="proposal.estimatedValue" />
        </Fact>
        <Fact :label="c('wealth.table.fee')">
          <Money :value="proposal.estimatedFeeImpact" />
        </Fact>
        <Fact :label="c('wealth.table.created')">
          <DateText :value="proposal.createdDate" />
        </Fact>
        <Fact :label="c('wealth.table.updated')">
          <DateText :value="proposal.updatedDate" />
        </Fact>
        <Fact :label="c('wealth.table.daysOpen')">
          <Num :value="proposal.daysOpen" />
        </Fact>
        <Fact :label="c('wealth.table.advisor')">{{ proposal.advisorName }}</Fact>
      </dl>
    </div>
  </Panel>
</template>

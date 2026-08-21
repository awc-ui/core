'use client';

// Transfer — linear vertical stepper: recipient, amount, OTP confirmation.

import { useRef, useState } from 'react';
import {
  MdCard,
  MdNumberField,
  MdOtpField,
  MdSelect,
  MdSelectOption,
  MdSnackbar,
  MdStep,
  MdStepper,
} from '@awc-ui/react/server';
import { PAYEES, currency } from '../../lib/data';

export default function TransferPage() {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [otp, setOtp] = useState('');
  const [resetKey, setResetKey] = useState(0);
  const [sentMessage, setSentMessage] = useState('');
  const [snackOpen, setSnackOpen] = useState(false);
  const otpRef = useRef<HTMLElement & { reportValidity: () => Promise<boolean> }>(null);

  const payee = PAYEES.find((p) => p.value === recipient);

  const stepValid = (index: number) => {
    if (index === 0) return recipient !== '';
    if (index === 1) return amount != null && amount >= 5;
    return otp.length === 6;
  };

  const handleComplete = () => {
    if (otp.length !== 6) {
      otpRef.current?.reportValidity();
      return;
    }
    setSentMessage(`${currency(amount ?? 0)} sent to ${payee?.label ?? 'recipient'}`);
    setSnackOpen(true);
    setRecipient('');
    setAmount(null);
    setOtp('');
    setResetKey((k) => k + 1);
  };

  return (
    <>
      <h2 className="section-title">Send money</h2>
      <MdCard variant="outlined">
        <div className="transfer-card-inner">
          <MdStepper
            key={resetKey}
            orientation="vertical"
            mode="linear"
            label="Transfer progress"
            finishLabel="Send transfer"
            onMdBeforeChange={(e) => {
              const { index, previous } = e.detail;
              if (index > previous && !stepValid(previous)) e.preventDefault();
            }}
            onMdComplete={handleComplete}
          >
            <MdStep label="Recipient" description="Choose who receives it">
              <div className="step-fields">
                <MdSelect
                  variant="outlined"
                  label="Send to"
                  filterable
                  fullWidth
                  value={recipient}
                  supportingText="Saved payees and your linked accounts"
                  filterLabel="Filter payees"
                  onMdChange={(e) => setRecipient(e.detail)}
                >
                  {PAYEES.map((p) => (
                    <MdSelectOption key={p.value} value={p.value}>
                      {p.label}
                    </MdSelectOption>
                  ))}
                </MdSelect>
              </div>
            </MdStep>

            <MdStep label="Amount" description="How much to send">
              <div className="step-fields">
                <MdNumberField
                  variant="outlined"
                  label="Amount"
                  min={5}
                  max={25000}
                  step={1}
                  smallStep={0.01}
                  required
                  formatOptions={{ style: 'currency', currency: 'USD' }}
                  supportingText="Between $5.00 and $25,000.00 per transfer"
                  onMdInput={(e) => setAmount(e.detail.value)}
                  onMdChange={(e) => setAmount(e.detail.value)}
                />
              </div>
            </MdStep>

            <MdStep label="Confirm" description="Verify with a one-time code">
              <div className="confirm-summary">
                <div className="row">
                  <span className="k">To</span>
                  <span className="v">{payee?.label ?? '—'}</span>
                </div>
                <div className="row">
                  <span className="k">Amount</span>
                  <span className="v">{amount != null ? currency(amount) : '—'}</span>
                </div>
                <div className="row">
                  <span className="k">Arrives</span>
                  <span className="v">{payee?.detail ?? '—'}</span>
                </div>
              </div>
              <MdOtpField
                ref={otpRef as never}
                length={6}
                label="Security code"
                required
                incompleteLabel="Enter all 6 digits of the code"
                valueMissingLabel="Enter the 6-digit code to confirm"
                supportingText="We sent a 6-digit code to your phone ···· 4407"
                onMdInput={(e) => setOtp(e.detail)}
                onMdComplete={(e) => setOtp(e.detail.value)}
              />
            </MdStep>
          </MdStepper>
        </div>
      </MdCard>
      <p className="muted" style={{ margin: 0 }}>
        Transfers to other Lumen Bank members arrive instantly. External transfers take 1–2
        business days.
      </p>

      <MdSnackbar
        open={snackOpen}
        message={sentMessage}
        closeable
        onMdClose={() => setSnackOpen(false)}
      />
    </>
  );
}

import { Lock } from 'lucide-react';

export default function InfoRow({
  icon: Icon,
  label,
  value,
  name,
  isEditing,
  onChange,
  theme,
  readOnly = false,
  multiline = false,
  placeholder = '',
  accentColor = '#8B5CF6',
}) {
  const showEditor = isEditing && name && !readOnly;

  return (
    <div className="profile-info-row">
      <div className="profile-info-label-row">
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: theme.label,
          }}
        >
          {label}
        </div>

        {readOnly && (
          <div
            className="profile-info-lock"
            title="Thông tin này không thể chỉnh sửa"
            style={{
              color: theme.label,
            }}
          >
            <Lock size={11} strokeWidth={2.2} />
          </div>
        )}
      </div>

      <div
        className={
          readOnly
            ? 'profile-info-content profile-info-content-plain'
            : 'profile-info-content'
        }
      >
        <div
          className="profile-info-icon"
          style={{
            color: accentColor,
          }}
        >
          <Icon size={20} strokeWidth={2.1} />
        </div>

        <div
          style={{
            flex: 1,
            minWidth: 0,
          }}
        >
          {showEditor ? (
            multiline ? (
              <textarea
                name={name}
                value={value || ''}
                onChange={onChange}
                placeholder={placeholder}
                rows={3}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',

                  border: `1px solid ${theme.inputBorder}`,

                  borderRadius: 10,

                  padding: '9px 11px',

                  background: theme.inputBg,

                  color: theme.text,

                  fontFamily: 'inherit',

                  fontSize: 14,

                  fontWeight: 600,

                  lineHeight: 1.6,

                  resize: 'vertical',

                  outline: 'none',
                }}
              />
            ) : (
              <input
                name={name}
                value={value || ''}
                onChange={onChange}
                placeholder={placeholder}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',

                  border: `1px solid ${theme.inputBorder}`,

                  borderRadius: 10,

                  padding: '9px 11px',

                  background: theme.inputBg,

                  color: theme.text,

                  fontFamily: 'inherit',

                  fontSize: 14,

                  fontWeight: 650,

                  outline: 'none',
                }}
              />
            )
          ) : (
            <div
              style={{
                color: value ? theme.text : theme.emptyText,

                fontSize: 15,

                fontWeight: 650,

                lineHeight: 1.55,

                wordBreak: 'break-word',

                whiteSpace: multiline ? 'pre-wrap' : 'normal',
              }}
            >
              {value || 'Chưa cập nhật'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

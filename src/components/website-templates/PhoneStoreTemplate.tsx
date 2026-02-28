// PhoneStoreTemplate is now a thin wrapper around UniversalStoreTemplate
// Kept for backward compatibility with any existing imports
import UniversalStoreTemplate, { UniversalTemplateProps } from './UniversalStoreTemplate';

type PhoneStoreTemplateProps = Omit<UniversalTemplateProps, 'templateId'>;

export default function PhoneStoreTemplate(props: PhoneStoreTemplateProps) {
  return <UniversalStoreTemplate {...props} templateId="phone_store" />;
}

import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface MessageSearchProps {
  onSearch: (query: string) => void;
}

export default function MessageSearch({ onSearch }: MessageSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleChange = (value: string) => {
    setQuery(value);
    onSearch(value);
  };

  const handleClear = () => {
    setQuery('');
    onSearch('');
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
      >
        <Search className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 animate-fade-in">
      <Search className="w-4 h-4 text-muted-foreground shrink-0" />
      <Input
        autoFocus
        placeholder="Search messages..."
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        className="h-7 text-xs bg-secondary border-glass-border w-40"
      />
      <button onClick={handleClear} className="text-muted-foreground hover:text-foreground">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

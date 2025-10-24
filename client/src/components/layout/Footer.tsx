
export function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="border-t bg-background/80 backdrop-blur-md py-4">
      <div className="container mx-auto px-4">
        <p className="text-center text-muted-foreground" style={{ fontSize: '9px' }}>
          © {currentYear} fliQ. Ver. 1.0.2
        </p>
      </div>
    </footer>
  );
}

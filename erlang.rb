require 'socket'
require 'stringio'
require 'digest/md5'

module Erlang

  class Tuple < Array
   alias arity length
   def to_s
     '{' + self.map{|e| e.inspect}.join(', ') + '}'
   end
   alias inspect to_s
  end

  class Binary
    attr_accessor :value
    def initialize(s)
      @value = s.to_s
    end
    def to_s
      "<<" + @value.bytes.join(',') + ">>"
    end
    alias inspect to_s
    def size
      @value.size
    end
  end

  class Ref
    attr_accessor :node, :ids, :creation
    def initialize(node, creation, *ids)
      @node = node
      @creation = creation
      @ids = ids
    end
  end

  class Pid
    attr_accessor :node, :id, :serial, :creation
    def initialize(node, id, serial, creation)
      @node = node
      @id = id
      @serial = serial
      @creation = creation
    end
    def to_s
      "<#{@node}:#{@creation}.#{@id}.#{@serial}>"
    end
   alias inspect to_s
  end

  class Port
    attr_accessor :node, :id, :creation
    def initialize(node, id, creation)
      @node = node
      @id = id
      @creation = creation
    end
    def to_s
      "<#Port:#{@node}:#{@creation}.#{@id}>"
    end
   alias inspect to_s
  end

  TYPE_NEW_FLOAT = 70
  TYPE_SMALL_INT = 97
  TYPE_INTEGER = 98
  TYPE_FLOAT = 99
  TYPE_ATOM = 100
  TYPE_PORT = 102
  TYPE_PID = 103
  TYPE_SMALL_TUPLE = 104
  TYPE_LARGE_TUPLE = 105
  TYPE_NIL = 106
  TYPE_STRING = 107
  TYPE_LIST = 108
  TYPE_BINARY = 109
  TYPE_BIG_INT = 110
  TYPE_NEW_REF = 114
  TYPE_MAP = 116

  @@decoder = {
    TYPE_SMALL_INT => lambda{|io| r_int8(io)},
    TYPE_INTEGER   => lambda{|io| r_int32(io)},
    TYPE_FLOAT     => lambda{|io| io.read(8).unpack("G")[0]},
    TYPE_ATOM      => lambda{|io| io.read(r_int16(io)).to_sym},
    TYPE_SMALL_TUPLE => lambda{|io| Tuple.new((1..r_int8(io)).map{from_binary(io)})},
    TYPE_LARGE_TUPLE => lambda{|io| Tuple.new((1..r_int32(io)).map{from_binary(io)})},
    TYPE_NIL       => lambda{|io| [] },
    TYPE_STRING    => lambda{|io| io.read(r_int16(io))},
    TYPE_LIST      => lambda{|io| a=(1..r_int32(io)).map{from_binary(io)};from_binary(io); a},
    TYPE_BINARY    => lambda{|io| Binary.new(io.read(r_int32(io)))},
    TYPE_PORT      => lambda{|io| Port.new(from_binary(io), r_int32(io), r_int8(io)) },
    TYPE_MAP       => lambda{|io| (1..r_int32(io)).reduce({}){|acc| acc[from_binary(io)] = from_binary(io); acc} },
    TYPE_PID       => lambda{|io|
                        node = from_binary(io)
                        (id,b,c) = io.read(9).unpack("NNc")
                        Pid.new(node, id, b, c) },
    TYPE_NEW_REF   => lambda{|io|
                        c = r_int16(io)
                        node = from_binary(io)
                        c2 = r_int8(io)
                        Ref.new(node, c, (1..c2).map{ r_int32(io)}) }
  }
  @@encoder = {
    Integer => lambda{|term| [TYPE_INTEGER, term].pack("cN") },
    Float   => lambda{|term| [TYPE_NEW_FLOAT, term].pack("cG") },
    Symbol  => lambda{|term| [TYPE_ATOM, term.to_s.size].pack("cn") + term.to_s },
    Tuple   => lambda{|term| [TYPE_SMALL_TUPLE, term.size].pack("cc") + term.map{|e| to_binary(e)}.join('') },
    String  => lambda{|term| [TYPE_STRING, term.size].pack("cn") + term },
    Array   => lambda{|term| [TYPE_LIST, term.size].pack("cN") + term.map{|e| to_binary(e)}.join('') + TYPE_NIL.chr },
    Binary  => lambda{|term| [TYPE_BINARY, term.size].pack("cN") + term.value },
    Bignum  => lambda{|term| s=term<0?1:0;term=term.abs;b=[];while term>0 do b<<(term&0xff);term>>=8 end
                             [TYPE_BIG_INT, b.size(), s].pack("ccc") + b.pack("c*") },
    Hash    => lambda{|term| [TYPE_MAP, term.size].pack("cN") + term.map{|k,v| [to_binary(k), to_binary(v)]}.join('') },
    Port    => lambda{|term| [TYPE_PORT].pack("c") + to_binary(term.node) + [term.id, term.creation].pack("Nc") },
    Pid     => lambda{|term| [TYPE_PID].pack("c") + to_binary(term.node) + [term.id, term.serial, term.creation].pack("NNc") },
    Ref     => lambda{|term| [TYPE_NEW_REF, term.ids.size].pack("cn") +
                              to_binary(term.node) + ([term.ids.size] + term.ids).pack("cN#{term.ids.length}") }
  }

  def r_int8(io)
    !io.eof? && io.getc.ord
  end
  def r_int16(io)
    io.read(2).unpack("n")[0]
  end
  def r_int32(io)
    io.read(4).unpack("N")[0]
  end
  module_function :r_int8, :r_int16, :r_int32

  def to_binary(term)
    if @@encoder[term.class]
      @@encoder[term.class].call(term)
    elsif term.is_a?(Integer)
      @@encoder[Integer].call(term)
    elsif term == true
      to_binary(:true)
    elsif term == false
      to_binary(:false)
    elsif term == nil
      TYPE_NIL.chr
    else
      puts "unknown type #{term}"
    end
  end

  def from_binary(sio)
    t = r_int8(sio)
    if @@decoder[t]
      @@decoder[t].call(sio)
    else
      puts "unknown tag #{t}"
      sio
    end
  end
  module_function :to_binary, :from_binary

  class Epmd
    def self.names(host="localhost", port = 4369)
      def self.read_msg(soc)
        len = soc.read(2).unpack("n")[0]
        soc.read(len)
      end
      def self.write_msg(soc, msg)
        soc.write([msg.length].pack("n*") + msg)
      end
      soc = TCPSocket.open(host, port)
      write_msg(soc, 'n')
      read_msg(soc)
      read_msg(soc).lines.map{|l|
        if l=~/name ([^\s]+) at port (\d+)/
          [$1, $2.to_i]
        end
      }
    end
  end

  class Node
    include Erlang
    attr_reader :name, :port, :soc
    def initialize(name, port)
      @name = name
      @port = port
      @soc = nil
    end

    def send(header, msg)
      packet = "p" + 131.chr + to_binary(header) + 131.chr + to_binary(msg)
      @soc.write([packet.length].pack("N") + packet)
    end
    def recv()
      len = @soc.read(4).unpack("N")[0]
      @soc.read(len)
    end

    DFLAG_PUBLISHED = 1
    DFLAG_ATOM_CACHE = 2
    DFLAG_EXTENDED_REFERENCES = 4
    DFLAG_DIST_MONITOR = 8
    DFLAG_FUN_TAGS = 0x10
    DFLAG_DIST_MONITOR_NAME = 0x20
    DFLAG_HIDDEN_ATOM_CACHE = 0x40
    DFLAG_NEW_FUN_TAGS = 0x80
    DFLAG_EXTENDED_PIDS_PORTS = 0x100
    DFLAG_EXPORT_PTR_TAG = 0x200
    DFLAG_BIT_BINARIES = 0x400
    DFLAG_NEW_FLOATS = 0x800
    DFLAG_UNICODE_IO = 0x1000
    DFLAG_DIST_HDR_ATOM_CACHE = 0x2000
    DFLAG_SMALL_ATOM_TAGS = 0x4000
    DFLAG_UTF8_ATOMS = 0x10000
    DFLAG_MAP_TAG = 0x20000

    def connect(port, selfnode, cookie)
      # handshake
      def read_msg(soc)
        len = r_int16(soc)
        soc.read(len)
      end
      def write_msg(soc, msg)
        soc.write([msg.length].pack("n*") + msg)
      end
      soc = TCPSocket.open((@name.split('@')[1] || "localhost"), port)
      version = 5
      flags = DFLAG_EXTENDED_REFERENCES | DFLAG_EXTENDED_PIDS_PORTS | DFLAG_NEW_FUN_TAGS | DFLAG_NEW_FLOATS | DFLAG_MAP_TAG

      msg = 'n' + [version].pack("n*") + [flags].pack("N*") + selfnode.to_s

      write_msg(soc, msg)

      status = read_msg(soc)
      if status != 's' + 'ok'
        raise("handshake status: " + status)
      end

      challenge_msg = read_msg(soc)
      code, version, flags, challenge, peer_name = challenge_msg.unpack("AnNNA*")
      digest = Digest::MD5.digest("#{cookie}#{challenge}")
      challengeA = rand(0x7fffffff)
      response = ["r", challengeA].pack("AN")+digest
      write_msg(soc, response)
      @name = peer_name

      challenge2 = read_msg(soc)
      if challenge2 == 'a'+Digest::MD5.digest("#{cookie}#{challengeA}")
        @soc = soc
        soc
      else
        raise("handshake error(challenge2)")
      end
    end
  end

  def close()
    @soc.close if @soc
    @soc = nil
  end

  class Erl
    include Erlang
    def initialize(node, cookie, host = "localhost", auto_connect = true)
      @node = node.to_sym
      @cookie = cookie
      @nodes = {}
      Epmd.names(host).each{|(name, port)|
        @nodes[name] = Node.new(name+ '@' + host, port)
        if auto_connect
          @nodes[name].connect(port, node, cookie)
        end
      }
    end

    def connect(nodename)
      host = nodename.to_s.split('@')[1] || "localhost"
      Epmd.names(host).each{|(name, port)|
        name += '@' + host
        if name == nodename.to_s
          node = Node.new(name, port)
          node.connect(port, node, @cookie)
          @nodes[name] = node
        end
      }
    end

    def down()
      @nodes.each_value{|n| n.close()}
    end

    CTRL_SEND = 2
    CTRL_REG_SEND = 6

    def rpc_call(node, mod, fun, args)
      from = Pid.new(@node, 10, 1, 1)
      ref = Ref.new(@node, 10, 1)
      #ref = :undefined
      to = :rex
      msg = Tuple[:'$gen_call', Tuple[from,ref], Tuple[:call, mod, fun, args, :user]]
      @nodes[node].send(Tuple[CTRL_REG_SEND, from, :'', to], msg)
      res = @nodes[node].recv()
      sio = StringIO.new(res)
      if sio.getc == 'p'
        r = []
        while r_int8(sio) == 131
          r << from_binary(sio)
        end
        r[1][1]
      else
        res
      end
    end

    def nodes()
      @nodes.map{|n,v|n}
    end
  end
end
